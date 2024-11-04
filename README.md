# faces
interactive memory sculpture, live at [somanyfaces.in](https://somanyfaces.in)

user experience
--------
When choosing the `become a face` option, the user's device's camera and microphone are used to create a new face that will appear in the black void. By choosing `view faces` you can view the sculpture, which will be randomly populated by faces already in the database. The user can use scrolling/swiping/dragging motions to rotate the camera and move it forwards and backwards, allowing them to view the faces from various angles. Any faces that also have audio will play their audio back at random intervals (with directional audio based on the user's camera position). Faces are spawned and despawned based on the camera's proximity to faces.  The camera will move automatically if left alone for 30 seconds. 

prerequisites
--------
-npm

-three.js (via npm)

-yomotsu cameraControls (via npm)

-face-api.js (included in repo)

-php 8.2+

setup
--------
1) set up a local server using something like [Xampp](https://www.apachefriends.org/download.html)
2) start the local server. In Xampp, this is done by pressing the start buttons for Apache and MySQL.
3) clone the repository to a folder within your localhost directory. (In the case of Xampp, probably c:/xampp/htdocs)
4) open phpAdmin, make `faces_db` and import the faces.sql file to make the `faces` table.
5) Go to the new directory in your terminal: `cd faces`.
6) Initiate npm: `npm i`
8) run: `npm run build`
9) open `localhost/faces/dist` in your browser to run the project

development mode
--------
This project hasn't been optimized for easy switching between production and development mode, `npm run dev`. For development, the following changes can be made:

1) in src/world.js and src/mediaRecord.js, change the path of calls to fetch() from `./database.php"` to `http://localhost:80/website/faces/public/database.php`, where 80 is the port used by my Xampp Apache server.
2) in public/database.php, change the image and audio save paths from `./img` and `../img` and from `./audio` to `../audio`
3) if there are any existing entries in the database, run this sql command to change paths:
   ```
   UPDATE faces
    SET image_url = REPLACE(image_url, '../', './');
    SET audio_url = REPLACE(audio_url, '../', './');
   ```
   (switch '../' and './' when switching from dev back to production mode)

image-loading
-------
The repo includes no images or audio recordings. These can be input manually using the `become a face` option from the main menu. 

To batch load a folder of images, you can uncomment the call in `src/world.js/initWorld` to `addPhotoBatchToDB()`. You can set the path in `database.php/loadBatchToDir`, using './' or '../' for production or development respectively. As is, this will create face entries with no audio, but it could be expanded to batch load audio as well.
