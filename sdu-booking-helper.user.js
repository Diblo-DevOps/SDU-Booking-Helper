// ==UserScript==
// @name         SDU Booking Helper
// @namespace    https://github.com/Diblo-DevOps/SDU-Booking-Helper
// @version      4.0.2
// @description  Help script for booking rooms at SDU
// @author       Diblo
// @match        https://mitsdu.sdu.dk/booking/Book.aspx
// @icon         https://www.sdu.dk/resources/images/sdu/favicon.ico
// @updateURL    https://raw.githubusercontent.com/Diblo-DevOps/SDU-Booking-Helper/main/sdu-booking-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/Diblo-DevOps/SDU-Booking-Helper/main/sdu-booking-helper.user.js
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.deleteValue
// @grant        GM_registerMenuCommand
// ==/UserScript==


// Conf
//
// teams:          A list of teams with SDU username and a small description - username is without @ and what is written afterwards. - Ex. [[['hemad20', 'simad19'], 'DevOps'], [['hemad20', 'simad19', 'frhan20'], 'CI CD']]
// day_of_week:    Default booking day of the week. - Ex. 0 for Sunday, 1 for Monday, etc.
// book_time:      Default booking time. Rooms can only be booked in steps of half an hour. - Ex. 8:00, 8:30, 9:00 etc.
// booking_length: A period can be booked from half an hour to a maximum of four hours in steps of half an hour. - Ex. 0.5, 1, 1.5 etc.
// rooms:          A list of default rooms to choose from with a small description. - Ex. [['Ø14-100-2b', 'Tek - Floor 1 - 6 seats'], ['Ø20-130-4', 'Tek - Floor 2 - 9 seats']]
//
// Conf End

(async function () {
    "use strict";

    // AB_TEAMS, AB_DAY_OF_WEEK, AB_BOOK_TIME, AB_BOOKING_LENGTH and AB_ROOMS is obsolete
    if (await GM.getValue('AB_TEAMS', -1) !== -1) {
        await GM.setValue('teams', await GM.getValue('AB_TEAMS', '[]'));
        await GM.deleteValue('AB_TEAMS');
        await GM.setValue('day_of_week', await GM.getValue('AB_DAY_OF_WEEK', 1));
        await GM.deleteValue('AB_DAY_OF_WEEK');
        await GM.setValue('book_time', await GM.getValue('AB_BOOK_TIME', '8:00'));
        await GM.deleteValue('AB_BOOK_TIME');
        await GM.setValue('booking_length', await GM.getValue('AB_BOOKING_LENGTH', 4));
        await GM.deleteValue('AB_BOOKING_LENGTH');
        await GM.setValue('rooms', await GM.getValue('AB_ROOMS', '[]'));
        await GM.deleteValue('AB_ROOMS');
    }

    // Global vars
    let opt_teams = JSON.parse(await GM.getValue('teams', '[]'));
    let opt_day_of_week = await GM.getValue('day_of_week', 1);
    let opt_book_time = await GM.getValue('book_time', '8:00');
    let opt_booking_length = await GM.getValue('booking_length', 4);
    let opt_rooms = JSON.parse(await GM.getValue('rooms', '[]'));

    const TEAM_COLS = {
        'col1': {
            'label': 'Team',
            'description': 'Ex. hemad20, simad19',
        },
        'col2': {
            'label': 'Description',
            'description': 'Ex. DevOps',
        }
    };
    const ROOM_COLS = {
        'col1': {
            'label': 'Room',
            'description': 'Ex. Ø14-100-2b',
        },
        'col2': {
            'label': 'Description',
            'description': 'Ex. Tek - Floor 1 - 6 seats',
        }
    };

    const doc = document;
    const byId = (name) => doc.getElementById(name);
    const byClass = (name) => doc.getElementsByClassName(name);

    // Methods
    function pad(num, size) {
        num = num.toString();
        while (num.length < size) {
            num = "0" + num;
        }
        return num;
    }

    function toNumber(num, defNum) {
        num = Number(num);
        if (isNaN(num)) {
            return defNum;
        }
        return num;
    }

    function parseIds(ids) {
        if (typeof ids !== 'string' || ids.trim().length === 0) {
            return [];
        }
        return ids.trim().split(/\s*,\s*/).map(String);
    }

    function roundHalfEven(num) {
        let _integer = num * 10 % 10;

        if (_integer > 5) {
            return toNumber((num).toFixed());
        }

        if (_integer < 5 && _integer > 0) {
            return toNumber(((num * 10 + 5 - _integer) / 10).toFixed(1));
        }

        return num;
    }


    // Input Panel
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    function addDatalistOptions(elm, items) {
        for (let i = items.length - 1; i >= 0; i--) {
            let new_elm = doc.createElement("option");
            new_elm.value = items[i][0];
            if (items[i].length === 2) {
                new_elm.text = items[i][1];
            }
            elm.appendChild(new_elm);
        }
    }

    function update_panel() {
        byId('AF_TEAMS').innerHTML = '';
        byId('AF_IDS').placeholder = TEAM_COLS.col1.description;
        try {
            if (opt_teams[0][0].length !== 0) {
                byId('AF_IDS').placeholder = opt_teams[0][0].join(', ');
                addDatalistOptions(byId('AF_TEAMS'), opt_teams);
            }
        } catch (err) {
        }

        let elms = byId('AF_DAY_OF_WEEK').options;
        for (let i = 0; i < elms.length; i++) {
            byId('AF_DAY_OF_WEEK').options[i].selected = false;
        }
        if (opt_day_of_week === 0) {
            byId('AF_DAY_OF_WEEK').options[6].selected = true;
        } else if (opt_day_of_week < 7) {
            byId('AF_DAY_OF_WEEK').options[opt_day_of_week - 1].selected = true;
        }

        if (opt_book_time.length > 0) {
            byId('AF_BOOK_TIME').value = opt_book_time;
        } else {
            byId('AF_BOOK_TIME').value = '8:00';
        }

        byId('AF_BOOKING_LENGTH').value = opt_booking_length;

        byId('AF_ROOMS').innerHTML = '';
        byId('AF_ROOM').placeholder = ROOM_COLS.col1.description;
        try {
            if (opt_rooms[0][0].length !== 0) {
                byId('AF_ROOM').placeholder = opt_rooms[0][0];
                addDatalistOptions(byId('AF_ROOMS'), opt_rooms);
            }
        } catch (err) {
        }
    }

    async function fill_in_date_and_time() {
        let book_time = byId("AF_BOOK_TIME").value.split(":");
        let weeks_from_now = toNumber(byId("AF_WEEKS_FROM_NOW").value, 0);
        let book_dt = new Date();

        // Set booking time
        let bookTime = new Date(Date.parse("01 Jan 1970 " + pad(toNumber(book_time[0], 0)) + ":" + pad(toNumber(book_time[1], 0))));
        book_dt.setHours(bookTime.getHours());
        if (bookTime.getMinutes() === 0) {
            book_dt.setMinutes(0);
        } else if (bookTime.getMinutes() > 30) {
            book_dt.setMinutes(60);
        } else {
            book_dt.setMinutes(30);
        }

        // Set booking date
        book_dt.setDate(book_dt.getDate() + (7 + toNumber(byId("AF_DAY_OF_WEEK").value, 5) - book_dt.getDay()) % 7 + 7 * weeks_from_now);
        if (weeks_from_now === 0 && book_dt < Date.now()) {
            book_dt.setDate(book_dt.getDate() + 7);
        }

        // Set datepickerinput value
        byId("datepickerinput").value = pad(book_dt.getDate(), 2) + "-" + pad(book_dt.getMonth() + 1, 2) + "-" + book_dt.getFullYear();

        // Set FromTime and ToTime value
        byId("FromTime").value = pad(book_dt.getHours(), 2) + ":" + pad(book_dt.getMinutes(), 2);

        let booking_length = roundHalfEven(toNumber(byId("AF_BOOKING_LENGTH").value, 4));
        if (booking_length < 0.5) {
            booking_length = 0.5;
        }
        book_dt.setMinutes(book_dt.getMinutes() + 60 * booking_length);
        byId("ToTime").value = pad(book_dt.getHours(), 2) + ":" + pad(book_dt.getMinutes(), 2);
    }

    async function fill_in_participants() {
        let ids = parseIds(byId("AF_IDS").value);
        if (ids.length === 0) {
            try {
                ids = opt_teams[0][0];
            } catch (err) {
            }
        }

        for (let i = 0; i < ids.length; i++) {
            byId("ParticipantTB").value = ids[i];
            byId("BodyContent_AddParticipantButton").click();
            while (byId("ParticipantTB").value === ids[i]) {
                if (byId("StatusPanel").style.display === "block") {
                    byId("ParticipantTB").value = "";
                    byId("StatusPanel").style.display = "none";
                } else {
                    await sleep(100);
                }
            }
        }
    }

    async function fill_in_room() {
        let room = byId("AF_ROOM").value;
        if (room.length === 0) {
            try {
                room = opt_rooms[0][0];
            } catch (err) {
            }
        }

        byId("booktypesearchid").click();
        byId("booktypenameid").click();

        let roomNameSearchTB = byId("RoomNameSearchTB");
        roomNameSearchTB.value = '';
        roomNameSearchTB.dispatchEvent(new Event('input'));
        roomNameSearchTB.value = room;
        roomNameSearchTB.dispatchEvent(new Event('input'));

        let suggestions = byClass('tt-suggestion');
        if (suggestions.length > 0) {
            suggestions[0].click();
        }
    }

    function fill_in(submit = false) {
        fill_in_date_and_time().then(() => {
            fill_in_participants().then(() => {
                fill_in_room().then(() => {
                    if (submit === true) {
                        byId('BookButton').click();
                    }
                });
            });
        });
    }

    const fill_in_and_submit = () => fill_in(true);

    function init_panel() {
        // Add css
        let new_elm = doc.createElement('style');
        new_elm.innerHTML =
            '#AF {' +
            '   bottom: 0;' +
            '   left: 0;' +
            '   position: fixed;' +
            '   z-index: 9999;' +
            '   width: 100%;' +
            '   box-shadow: inset 0 -1px 0 rgb(255 255 255 / 15%), 0 -1px 5px rgb(0 0 0 / 8%);' +
            '   background: #f9f9f9;' +
            '   border-top: 1px solid #e7e7e7;' +
            '   padding: 20px 10px;' +
            '   display: inline-grid;' +
            '   justify-content: center;' +
            '   align-items: center;' +
            '   grid-column-gap: 10px;' +
            '   grid-template-columns: auto auto;' +
            '   grid-row-gap: 5px;' +
            '}' +
            '#AF span {' +
            '   white-space: nowrap;' +
            '}' +
            '#AF label {' +
            '   margin: 0 5px 0 0;' +
            '}' +
            '#AF_DAY_OF_WEEK {' +
            '   height: 26px;' +
            '}' +
            '#AF_WEEKS_FROM_NOW, #AF_BOOKING_LENGTH, #AF_BOOK_TIME {' +
            '   width: 59px;' +
            '}' +
            '#AF_ROOM {' +
            '   width: 120px;' +
            '}' +
            '#AF_OPTIONS {' +
            '   max-width: 26px;' +
            '   min-width: 26px;' +
            '   cursor: pointer;' +
            '}' +
            '#AF_INPUTS {' +
            '   display: inline-grid;' +
            '   grid-template-columns: auto auto auto auto auto auto;' +
            '   justify-items: end;' +
            '   grid-column-gap: 10px;' +
            '   grid-row-gap: 5px;' +
            '}' +
            '#AF_BUTTONS {' +
            '   display: inline-grid;' +
            '   grid-template-columns: auto auto auto;' +
            '   grid-column-gap: 10px;' +
            '   justify-content: space-between;' +
            '}' +
            '@media only screen and (max-width: 1220px) {' +
            '   #AF_INPUTS {' +
            '       grid-template-columns: auto auto auto;' +
            '   }' +
            '}' +
            '@media only screen and (max-width: 790px) {' +
            '   #AF_INPUTS {' +
            '       grid-template-columns: auto auto;' +
            '   }' +
            '}' +
            '@media only screen and (max-width: 630px) {' +
            '   #AF {' +
            '       grid-template-columns: auto;' +
            '   }' +
            '}' +
            '@media only screen and (max-width: 490px) {' +
            '   #AF_INPUTS {' +
            '       grid-template-columns: auto;' +
            '   }' +
            '   #AF_BUTTONS {' +
            '       justify-content: space-around;' +
            '   }' +
            '}';
        doc.getElementsByTagName("body")[0].appendChild(new_elm);

        new_elm = doc.createElement('div');
        new_elm.innerHTML =
            '<div id="AF">' +
            '   <div id="AF_INPUTS">' +
            '       <span>' +
            '           <label>Participants:</label>' +
            '           <input type="text" list="AF_TEAMS" id="AF_IDS">' +
            '           <datalist id="AF_TEAMS">' +
            '           </datalist>' +
            '       </span>' +
            '       <span>' +
            '           <label>Day:</label>' +
            '           <select id="AF_DAY_OF_WEEK">' +
            '               <option value="1">Monday</option>' +
            '               <option value="2">Tuesday</option>' +
            '               <option value="3">Wednesday</option>' +
            '               <option value="4">Thursday</option>' +
            '               <option value="5">Friday</option>' +
            '               <option value="6">Saturday</option>' +
            '               <option value="0">Sunday</option>' +
            '           </select>' +
            '       </span>' +
            '       <span><label>Weeks from now:</label><input type="number" min="0" step="1" id="AF_WEEKS_FROM_NOW" value="0"></span>' +
            '       <span><label>From:</label><input type="text" id="AF_BOOK_TIME"></span>' +
            '       <span><label>Length:</label><input type="number" min="0.5" step="0.5" id="AF_BOOKING_LENGTH"></span>' +
            '       <span>' +
            '           <label>Room:</label>' +
            '           <input type="text" list="AF_ROOMS" id="AF_ROOM">' +
            '           <datalist id="AF_ROOMS">' +
            '           </datalist>' +
            '       </span>' +
            '   </div>' +
            '   <div id="AF_BUTTONS">' +
            '       <input type="button" id="AF_ADD" value="Add">' +
            '       <input type="button" id="AF_BOOK" value="Book">' +
            '       <svg id="AF_OPTIONS" xmlns="http://www.w3.org/2000/svg" viewBox="2.220446049250313e-16 -0.00009999999999998899 3.2657 3.2658000000000005">' +
            '           <path d="M 3.0986 1.29 l -0.2292 -0.0389 c -0.0239 -0.0771 -0.0546 -0.1514 -0.0921 -0.2224 l 0.1351 -0.189 c 0.0573 -0.0805 0.0484 -0.1903 -0.0218 -0.2599 l -0.2033 -0.2033 c -0.0382 -0.0382 -0.0887 -0.0594 -0.1426 -0.0594 c -0.0423 0 -0.0825 0.013 -0.1167 0.0375 l -0.1897 0.1351 c -0.0737 -0.0389 -0.1508 -0.0709 -0.2306 -0.0948 l -0.0382 -0.2265 c -0.0164 -0.0976 -0.1003 -0.1685 -0.1992 -0.1685 h -0.2872 c -0.0989 0 -0.1828 0.0709 -0.1992 0.1685 l -0.0396 0.2319 c -0.0764 0.0239 -0.1508 0.0553 -0.2217 0.0935 l -0.1876 -0.1351 c -0.0341 -0.0246 -0.075 -0.0375 -0.1173 -0.0375 c -0.0539 0 -0.1051 0.0211 -0.1426 0.0594 l -0.204 0.2033 c -0.0696 0.0696 -0.0791 0.1794 -0.0218 0.2599 l 0.1364 0.1917 c -0.0375 0.0716 -0.0675 0.146 -0.0907 0.2231 l -0.2265 0.0382 c -0.0976 0.0164 -0.1685 0.1003 -0.1685 0.1992 v 0.2872 c 0 0.0989 0.0709 0.1828 0.1685 0.1992 l 0.2319 0.0396 c 0.0239 0.0764 0.0553 0.1508 0.0935 0.2217 l -0.1344 0.1869 c -0.0573 0.0805 -0.0484 0.1903 0.0218 0.2599 l 0.2033 0.2033 c 0.0382 0.0382 0.0887 0.0594 0.1426 0.0594 c 0.0423 0 0.0825 -0.013 0.1167 -0.0375 l 0.1917 -0.1364 c 0.0689 0.0362 0.1412 0.0655 0.2156 0.0887 l 0.0382 0.2292 c 0.0164 0.0976 0.1003 0.1685 0.1992 0.1685 h 0.2879 c 0.0989 0 0.1828 -0.0709 0.1992 -0.1685 l 0.0389 -0.2292 c 0.0771 -0.0239 0.1514 -0.0546 0.2224 -0.0921 l 0.189 0.1351 c 0.0341 0.0246 0.075 0.0375 0.1173 0.0375 l 0 0 c 0.0539 0 0.1044 -0.0211 0.1426 -0.0594 l 0.2033 -0.2033 c 0.0696 -0.0696 0.0791 -0.1794 0.0218 -0.2599 l -0.1351 -0.1897 c 0.0375 -0.0716 0.0689 -0.146 0.0921 -0.2224 l 0.2292 -0.0382 c 0.0976 -0.0164 0.1685 -0.1003 0.1685 -0.1992 v -0.2872 C 3.2671 1.3903 3.1961 1.3064 3.0986 1.29 z M 3.0829 1.7765 c 0 0.0089 -0.0061 0.0164 -0.015 0.0177 l -0.2865 0.0478 c -0.0362 0.0061 -0.0648 0.0327 -0.0737 0.0675 c -0.0259 0.1003 -0.0655 0.1965 -0.1187 0.2858 c -0.0184 0.0314 -0.0171 0.0703 0.0041 0.1003 l 0.1685 0.2374 c 0.0048 0.0068 0.0041 0.0171 -0.002 0.0232 l -0.2033 0.2033 c -0.0048 0.0048 -0.0096 0.0055 -0.013 0.0055 c -0.0041 0 -0.0075 -0.0014 -0.0102 -0.0034 l -0.2367 -0.1685 c -0.0293 -0.0211 -0.0689 -0.0225 -0.1003 -0.0041 c -0.0894 0.0532 -0.1856 0.0928 -0.2858 0.1187 c -0.0355 0.0089 -0.0621 0.0382 -0.0675 0.0737 l -0.0484 0.2865 c -0.0014 0.0089 -0.0089 0.015 -0.0177 0.015 h -0.2872 c -0.0089 0 -0.0164 -0.0061 -0.0177 -0.015 l -0.0478 -0.2865 c -0.0061 -0.0362 -0.0327 -0.0648 -0.0675 -0.0737 c -0.0976 -0.0252 -0.1917 -0.0641 -0.2797 -0.1146 c -0.0143 -0.0082 -0.0307 -0.0123 -0.0464 -0.0123 c -0.0184 0 -0.0375 0.0055 -0.0532 0.0171 l -0.2388 0.1699 c -0.0034 0.002 -0.0068 0.0034 -0.0102 0.0034 c -0.0027 0 -0.0082 -0.0007 -0.013 -0.0055 l -0.2033 -0.2033 c -0.0061 -0.0061 -0.0068 -0.0157 -0.002 -0.0232 l 0.1678 -0.2354 c 0.0211 -0.03 0.0225 -0.0696 0.0041 -0.101 c -0.0532 -0.0887 -0.0941 -0.1849 -0.1201 -0.2852 c -0.0096 -0.0348 -0.0382 -0.0614 -0.0737 -0.0675 l -0.2886 -0.0491 c -0.0089 -0.0014 -0.015 -0.0089 -0.015 -0.0177 v -0.2872 c 0 -0.0089 0.0061 -0.0164 0.015 -0.0177 l 0.2845 -0.0478 c 0.0362 -0.0061 0.0655 -0.0327 0.0744 -0.0682 c 0.0252 -0.1003 0.0641 -0.1972 0.1167 -0.2865 c 0.0184 -0.0314 0.0164 -0.0703 -0.0048 -0.0996 l -0.1699 -0.2388 c -0.0048 -0.0068 -0.0041 -0.0171 0.002 -0.0232 l 0.2033 -0.2033 c 0.0048 -0.0048 0.0096 -0.0055 0.013 -0.0055 c 0.0041 0 0.0075 0.0014 0.0102 0.0034 l 0.2354 0.1678 c 0.03 0.0211 0.0696 0.0225 0.101 0.0041 c 0.0887 -0.0532 0.1849 -0.0941 0.2852 -0.1201 c 0.0348 -0.0096 0.0614 -0.0382 0.0675 -0.0737 l 0.0491 -0.2886 c 0.0014 -0.0089 0.0089 -0.015 0.0177 -0.015 h 0.2872 c 0.0089 0 0.0164 0.0061 0.0177 0.015 l 0.0478 0.2845 c 0.0061 0.0362 0.0327 0.0655 0.0682 0.0744 c 0.103 0.0259 0.2012 0.0662 0.2927 0.1201 c 0.0314 0.0184 0.0703 0.0171 0.1003 -0.0041 l 0.2354 -0.1692 c 0.0034 -0.002 0.0068 -0.0034 0.0102 -0.0034 c 0.0027 0 0.0082 0.0007 0.013 0.0055 l 0.2033 0.2033 c 0.0061 0.0061 0.0068 0.0157 0.002 0.0232 l -0.1685 0.2367 c -0.0211 0.0293 -0.0225 0.0689 -0.0041 0.1003 c 0.0532 0.0894 0.0928 0.1856 0.1187 0.2858 c 0.0089 0.0355 0.0382 0.0621 0.0737 0.0675 l 0.2865 0.0484 c 0.0089 0.0014 0.015 0.0089 0.015 0.0177 v 0.2872 H 3.0829 z M 1.6332 0.9278 c -0.3889 0 -0.7047 0.3159 -0.7047 0.7047 s 0.3159 0.7047 0.7047 0.7047 s 0.7047 -0.3159 0.7047 -0.7047 S 2.022 0.9278 1.6332 0.9278 z M 1.6332 2.153 c -0.2872 0 -0.5205 -0.2333 -0.5205 -0.5205 s 0.2333 -0.5205 0.5205 -0.5205 s 0.5205 0.2333 0.5205 0.5205 S 1.9204 2.153 1.6332 2.153 z" fill="#000000"/>' +
            '       </svg>' +
            '   </div>' +
            '</div>';
        doc.getElementsByTagName("body")[0].appendChild(new_elm);

        update_panel();

        byId("AF_ADD").addEventListener("click", fill_in);
        byId("AF_BOOK").addEventListener("click", fill_in_and_submit);
        byId("AF_OPTIONS").addEventListener("click", show_option);
    }


    // Options
    function disableScroller(state = true) {
        let body = doc.getElementsByTagName("body")[0];
        if (state === true) {
            body.style.height = '100%';
            body.style.overflow = 'hidden';
        } else {
            body.style.height = 'inherit';
            body.style.overflow = 'inherit';
        }
    }

    function show_option() {
        byId('AF_SET_HOLDER').style.display = 'inline-grid';
        disableScroller();
    }

    function close_option() {
        byId('AF_SET_HOLDER').style.display = 'none';
        disableScroller(false);
    }

    function save_and_close_option() {
        save().then(() => {
            update_panel();
            close_option();
        });
    }

    async function save() {
        let value_elms = byClass('af_set_teams_val');
        let desc_elms = byClass('af_set_teams_desc');
        let array = [];
        for (let i = 0; i < value_elms.length; i++) {
            let ids = parseIds(value_elms[i].value);
            if (ids.length > 0) {
                array.push([ids, desc_elms[i].value]);
            }
        }
        opt_teams = array;
        await GM.setValue('teams', JSON.stringify(opt_teams));

        value_elms = byClass('af_set_rooms_val');
        desc_elms = byClass('af_set_rooms_desc');
        array = [];
        for (let i = 0; i < value_elms.length; i++) {
            let val = value_elms[i].value;
            if (typeof val === 'string' && val.length > 0) {
                array.push([val, desc_elms[i].value]);
            }
        }
        opt_rooms = array;
        await GM.setValue('rooms', JSON.stringify(opt_rooms));

        opt_day_of_week = toNumber(byId('AF_SET_DAY_OF_WEEK').value, 1);
        await GM.setValue('day_of_week', opt_day_of_week);

        let hour = toNumber(byId('AF_SET_BOOK_TIME_HOUR').value, 8);
        let min = toNumber(byId('AF_SET_BOOK_TIME_MIN').value, 0);
        opt_book_time = pad(hour, 2) + ':' + pad(min, 2);
        await GM.setValue('book_time', opt_book_time);

        opt_booking_length = roundHalfEven(toNumber(byId('AF_SET_BOOKING_LENGTH').value, 4));
        if (opt_booking_length < 0.5) {
            opt_booking_length = 0.5;
        }
        await GM.setValue('booking_length', opt_booking_length);
    }

    function sortByClass(elms) {
        let elms_by_class = {};
        for (let i = 0; i < elms.length; i++) {
            let _class = elms[i].className;
            if (elms_by_class[_class] === undefined) {
                elms_by_class[_class] = [];
            }
            elms_by_class[_class].push(elms[i]);
        }
        return elms_by_class;
    }

    function update_remove_buttons_availability() {
        let elms = byId('AF_SET_HOLDER').querySelectorAll('input[class*="_remove"]');
        for (const [_, _elms] of Object.entries(sortByClass(elms))) {
            let state = _elms.length <= 1;
            for (let i = 0; i < _elms.length; i++) {
                _elms[i].disabled = state;
            }
        }
    }

    const uniqId = (() => {
        let i = 0;
        return () => {
            return i++;
        }
    })();

    function add_row(id, cols, value1 = '', value2 = '') {
        let values = [];
        if (typeof value1 === "string" && value1.trim() !== '') {
            values[0] = ' value="' + value1.trim() + '"';
        }
        if (typeof value2 === "string" && value2.trim() !== '') {
            values[1] = ' value="' + value2.trim() + '"';
        }

        let uid = uniqId();
        let elm = byId(id);
        elm.innerHTML = elm.innerHTML +
            '   <span class="setting_table" id="' + id + '_' + uid + '">' +
            '       <label for="' + id + '_VAL_' + uid + '">' + cols.col1.label + ':</label>' +
            '       <input type="text" id="' + id + '_VAL_' + uid + '" class="' + id.toLowerCase() + '_val" placeholder="' + cols.col1.description + '"' + values[0] + '>' +
            '       <label for="' + id + '_DESC_' + uid + '">' + cols.col1.label + ':</label>' +
            '       <input type="text" id="' + id + '_DESC_' + uid + '" class="' + id.toLowerCase() + '_desc" placeholder="' + cols.col2.description + '"' + values[1] + '>' +
            '       <input type="button" id="' + id + '_REMOVE_' + uid + '" class="' + id.toLowerCase() + '_remove" value="Remove">' +
            '   </span>';

        update_remove_buttons_availability();
    }

    function remove_row(event) {
        let id = event.target.id;

        if (!id.includes("_REMOVE_")) return;

        let elem = byId(id.replace('REMOVE_', ''));
        elem.parentNode.removeChild(elem);

        update_remove_buttons_availability();
    }

    function init_option() {
        // Add css
        let new_elm = doc.createElement('style');
        new_elm.innerHTML =
            '#AF_SET_HOLDER {' +
            '   position: fixed;' +
            '   top: 0;' +
            '   left: 0;' +
            '   z-index: 10000;' +
            '   width: 100%;' +
            '   height: 100%;' +
            '   display: none;' +
            '   justify-items: center;' +
            '   align-items: center;' +
            '   background-color: #00000059;' +
            '}' +
            // #e7e7e7, #50aaf7
            '#AF_SET {' +
            '   background-color: #f9f9f9;' +
            '   padding: 10px;' +
            '   margin: 10px;' +
            '   border: 1px solid #e7e7e7;' +
            '   box-shadow: inset 0 0 0 rgb(255 255 255 / 15%), 5px 5px 5px rgb(0 0 0 / 8%);' +
            '   overflow: auto;' +
            '   display: inline-grid;' +
            '   grid-row-gap: 20px;' +
            '   max-height: 90%' +
            '}' +
            '#AF_SET label {' +
            '   margin: 0;' +
            '}' +
            '#AF_SET_DAY_OF_WEEK, #AF_SET_BOOK_TIME_HOUR, #AF_SET_BOOK_TIME_MIN {' +
            '   height: 26px;' +
            '}' +
            '#AF_SET p {' +
            '   font-size: 15px;' +
            '   font-weight: bold;' +
            '   margin: 0;' +
            '   border-bottom: 1px solid #a9a9a9;' +
            '}' +
            '#af_set_other {' +
            '   display: inline-grid;' +
            '   grid-template-columns: 1fr 1fr;' +
            '   grid-row-gap: 10px;' +
            '   align-items: center;' +
            '}' +
            '#AF_SET_HEAD {' +
            '   margin: -10px -10px -5px;' +
            '   padding: 5px;' +
            '   background-color: #50aaf7;' +
            '   font-weight: bold;' +
            '}' +
            '.setting_table {' +
            '    display: inline-grid;' +
            '    grid-template-columns: auto 1fr auto 1fr auto;' +
            '    grid-column-gap: 5px;' +
            '    align-items: center;' +
            '}' +
            '#AF_SET_BUTTONS {' +
            '    display: inline-grid;' +
            '    grid-template-columns: auto auto;' +
            '    grid-column-gap: 10px;' +
            '    justify-content: end;' +
            '}' +
            '#AF_SET_TEAMS, #AF_SET_ROOMS {' +
            '    display: inline-grid;' +
            '    grid-row-gap: 5px;' +
            '}';
        doc.getElementsByTagName("body")[0].appendChild(new_elm);

        new_elm = doc.createElement('div');
        new_elm.innerHTML =
            '<div id="AF_SET_HOLDER">' +
            '<div id="AF_SET">' +
            '   <div id="AF_SET_HEAD">SDU Booking Helper: Options</div>' +
            '   <p>Teams</p>' +
            '   <div id="AF_SET_TEAMS">' +
            '   </div>' +
            '   <input type="button" id="AF_SET_ADD_TEAM" value="Add Team">' +
            '   <p>Rooms</p>' +
            '   <div id="AF_SET_ROOMS">' +
            '   </div>' +
            '   <input type="button" id="AF_SET_ADD_ROOM" value="Add Room">' +
            '   <p>Other</p>' +
            '<span id="af_set_other">' +
            '   <label>Default Booking Day:</label>' +
            '   <select id="AF_SET_DAY_OF_WEEK">' +
            '       <option value="1">Monday</option>' +
            '       <option value="2">Tuesday</option>' +
            '       <option value="3">Wednesday</option>' +
            '       <option value="4">Thursday</option>' +
            '       <option value="5">Friday</option>' +
            '       <option value="6">Saturday</option>' +
            '       <option value="0">Sunday</option>' +
            '   </select>' +
            '   <label>Default Booking Time:</label>' +
            '   <span>' +
            '       <select id="AF_SET_BOOK_TIME_HOUR">' +
            '           <option value="0">00</option>' +
            '           <option value="1">01</option>' +
            '           <option value="2">02</option>' +
            '           <option value="3">03</option>' +
            '           <option value="4">04</option>' +
            '           <option value="5">05</option>' +
            '           <option value="6">06</option>' +
            '           <option value="7">07</option>' +
            '           <option value="8">08</option>' +
            '           <option value="9">09</option>' +
            '           <option value="10">10</option>' +
            '           <option value="11">11</option>' +
            '           <option value="12">12</option>' +
            '           <option value="13">13</option>' +
            '           <option value="14">14</option>' +
            '           <option value="15">15</option>' +
            '           <option value="16">16</option>' +
            '           <option value="17">17</option>' +
            '           <option value="18">18</option>' +
            '           <option value="19">19</option>' +
            '           <option value="20">20</option>' +
            '           <option value="21">21</option>' +
            '           <option value="22">22</option>' +
            '           <option value="23">23</option>' +
            '       </select>' +
            '       :' +
            '       <select id="AF_SET_BOOK_TIME_MIN">' +
            '           <option value="0">00</option>' +
            '           <option value="30">30</option>' +
            '       </select>' +
            '   </span>' +
            '   <label>Default Booking Length:</label><input type="number" min="0.5" step="0.5" id="AF_SET_BOOKING_LENGTH">' +
            '</span>' +
            '   <span id="AF_SET_BUTTONS">' +
            '       <input type="button" id="AF_SET_CANCEL" value="Cancel">' +
            '       <input type="button" id="AF_SET_SAVE" value="Save">' +
            '   </span>' +
            '</div>' +
            '</div>';
        doc.getElementsByTagName("body")[0].appendChild(new_elm);

        // Add values
        if (opt_teams[0] !== undefined && Array.isArray(opt_teams[0][0]) === true && opt_teams[0][0].length !== 0) {
            for (let i = 0; i < opt_teams.length; i++) {
                add_row('AF_SET_TEAMS', TEAM_COLS, opt_teams[i][0].join(', '), opt_teams[i][1]);
            }
        } else {
            add_row('AF_SET_TEAMS', TEAM_COLS);
        }

        if (opt_day_of_week === 0) {
            byId('AF_SET_DAY_OF_WEEK').options[6].selected = true;
        } else if (opt_day_of_week < 7) {
            byId('AF_SET_DAY_OF_WEEK').options[opt_day_of_week - 1].selected = true;
        }

        if (typeof opt_book_time === 'string' && opt_book_time.length > 0) {
            let book_time = opt_book_time.split(':');
            byId('AF_SET_BOOK_TIME_HOUR').options[toNumber(book_time[0], 8)].selected = true;
            if (toNumber(book_time[1], 0) >= 30) {
                byId('AF_SET_BOOK_TIME_MIN').options[1].selected = true;
            }
        }

        byId('AF_SET_BOOKING_LENGTH').value = opt_booking_length;

        if (opt_rooms[0] !== undefined && typeof opt_rooms[0][0] === 'string' && opt_rooms[0][0].length !== 0) {
            for (let i = 0; i < opt_rooms.length; i++) {
                add_row('AF_SET_ROOMS', ROOM_COLS, opt_rooms[i][0], opt_rooms[i][1]);
            }
        } else {
            add_row('AF_SET_ROOMS', ROOM_COLS);
        }

        // Event Listener
        byId("AF_SET_ADD_TEAM").addEventListener("click", () => {
            add_row('AF_SET_TEAMS', TEAM_COLS);
        });
        byId("AF_SET_ADD_ROOM").addEventListener("click", () => {
            add_row('AF_SET_ROOMS', ROOM_COLS);
        });
        byId("AF_SET_CANCEL").addEventListener("click", close_option);
        byId("AF_SET_SAVE").addEventListener("click", save_and_close_option);

        byId('AF_SET_TEAMS').addEventListener("click", remove_row);
        byId('AF_SET_ROOMS').addEventListener("click", remove_row);

        // Tampermonkey Menu
        GM_registerMenuCommand("Options", show_option);
    }

    init_panel();
    init_option();
})();
