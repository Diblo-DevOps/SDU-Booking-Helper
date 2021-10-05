# SDU-Booking-Helper

This script is based off of Javascript, and makes it easy and simple to book rooms for TEK-students.

To use the script, you either have to install the extension TamperMonkey (Chrome) or Greasemonkey (Firefox), both of which allows you to execute scripts in your browser.
After installing the extension, do the following:

1. Open the JavaScript file in the repository. 
2. Press the button to convert the code to a raw format (RAW)
   ![RawImage](https://github.com/simonkruger10/SDU-Booking-Helper/blob/main/Images/RawScript.png)
3. Copy the code in question, all of it.
4. Click on the extension symbol, go to dashboard.
   ![TamperMonkey](https://github.com/simonkruger10/SDU-Booking-Helper/blob/main/Images/Tampermonkey.png)
5. Press the "+" icon (create new script).
6. Paste the code into TamperMonkey / Greasemonkey.
   ![Replace](https://github.com/simonkruger10/SDU-Booking-Helper/blob/main/Images/Replace.png)
7. After pasting the code into TamperMonkey and saving, you should now be able to use it on the booking page. Go to https://mitsdu.sdu.dk/booking/Book.aspx. At the bottom of the page, you should be able to spot a user interface.
The interface is fairly user-friendly, and the actions should be fairly easy to understand. 
8. In the settings, you can create new teams, add new rooms to the general booking setting, as well as default booking times. 
The "add" function set the website to match your changes, meaning that the team, the room, the day etc. is added to the website. Using the "book" function books the given room
   ![UI](https://github.com/simonkruger10/SDU-Booking-Helper/blob/main/Images/Settings.png)
