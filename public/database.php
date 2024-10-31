<?php 

header('Access-Control-Allow-Origin: *'); // Allow all origins
header('Access-Control-Allow-Methods: POST, GET, OPTIONS'); // Allow certain methods
header('Access-Control-Allow-Headers: Content-Type'); // Allow certain headers
//change this after development

$path = dirname(__DIR__);
$serverName = "localhost";
$userName = "root";
$password = "";
$database = "faces_db";
$port = "3306";
$tableName = "faces";

class FaceData
{
    public $id, $imageUrl, $audioUrl;
    public function __construct(int $id, string $imageUrl, string $audioUrl)
    {
        $this->id = $id;
        $this->imageUrl = $imageUrl;
        $this->audioUrl = $audioUrl;
    }
}

function saveImage()
{
    global $path;
    if(!isset($_FILES["image_data"]) || $_FILES['image_data']['error'] != UPLOAD_ERR_OK)
    {
        return false;
    }
    
    if (!file_exists($path . "/img")) {
        mkdir($path . "/img", 0777, true);
    }
    
    $file_name = "./img/" . time() . '.webp';
    //$file_name = "../img/" . time() . '.webp'; for npm run dev
    $imageData = $_FILES['image_data']['tmp_name'];
    
    $success = move_uploaded_file($imageData, $file_name);
    return $success ? $file_name : $success;
}

function saveAudio()
{
    global $path;
    if(!isset($_FILES["audio_data"]) || $_FILES['audio_data']['error'] != UPLOAD_ERR_OK)
    {
        print isset($_FILES["audio_data"]) ? 'audio set' : 'audio not set' ;
        print ($_FILES['audio_data']['error'] == UPLOAD_ERR_OK) ? ' no audio error' : ' audio error';
        return false;
    }
    if (!file_exists($path . "/audio")) 
    {
        mkdir($path . "/audio", 0777, true);
    }
    $file_name = "./audio/" . time() . ".mp3";
    //$file_name = "../audio/" . time() . ".mp3"; //for dev mode (npm run dev)

    // Move the uploaded file to the desired directory
    $success = move_uploaded_file($_FILES['audio_data']['tmp_name'], $file_name);
    return $success ? $file_name : $success;
    
}

function connectToDB()
{    
    global $serverName, $userName, $password, $database, $port;
    $mySqli = new mysqli($serverName,
                            $userName,
                            $password,
                            $database,
                            $port);
    if($mySqli->connect_error)
    {
        die("Connection to " . $database . " failed: " .$mySqli->connect_error);
    }
    else
    {
        return $mySqli;
    }
}
function loadBatchToDir()
{
    global $tableName;
    $mySqli = connectToDB();
    $dir = dirname(__DIR__) . '/    ';
    $files = scandir($dir);
    foreach ($files as $f)
    {        
        if($f != '.' && $f != '..')
        {
            $query = "INSERT INTO " . $tableName . "(image_url) VALUES (?)";
            $stmt = $mySqli->prepare($query);
            $fWDir = './justImg/' . $f;
            //$fWDir = '../justImg/' . $f; //for dev mode
            $stmt->bind_param('s', $fWDir);
            $stmt->execute();
        }
    }
    $mySqli->close();
    print json_encode("loaded " . $dir);
}

function saveToDatabase(string $audio_name, string $image_name)
{
    global $tableName;
    $mySqli = connectToDB();
    $mySqli->query("SET time_zone = '+08:00'");

    $queryStatement = "INSERT INTO " . $tableName . " (image_url, audio_url) 
    VALUES ('{$image_name}', '{$audio_name}');";
    $result = $mySqli->query($queryStatement); 
    $mySqli->close();
    return $result;
}
function saveData()
{
    $audioUrl = saveAudio();    
    if(!$audioUrl)
    {
        print 'audio not saved';
        return;
    }

    $imageUrl = saveImage();
    if(!$imageUrl)
    {
        print 'image not saved';
        return;
    }

    $dbResult = saveToDatabase($audioUrl, $imageUrl);
    if(!$dbResult)
    {
        print 'data not saved to table';
        return;
    }
    print $dbResult;
}

function fetchData()
{
    global $tableName;
    $mySqli = connectToDB();
    $queryStatement = 'SELECT * FROM ' . $tableName . ' ORDER BY id ASC';
    //$queryStatement = 'SELECT * FROM ' . $tableName . ' WHERE audio_url IS NOT NULL' ;
    $result = $mySqli->query($queryStatement);
    $mySqli->close();
    $faceArr = convertSqlResultToArray($result);
    shuffle($faceArr);
    $assArr = array_map(function($a) { return get_object_vars($a);}, $faceArr);
    
    print json_encode($assArr);
}

function convertSqlResultToArray($result)
{
    $faceArr = array();
    $i = 0;
        
    while (($row = mysqli_fetch_array($result)))// && $i < 4)
    {        
        $aurl = $row['audio_url'] ? $row['audio_url'] : '';
        $iurl = $row['image_url'];
        $id = $row['id'];
    
        $a = new FaceData($id, $iurl, $aurl);        

        if($a->imageUrl)//$i == 8 || $i == 9)
        {
            array_push($faceArr, $a);
        }
        $i++;
    }
    return $faceArr;
}

function getNewRows($pollingIntervalS)
{
    $tMinusTen = date('Y-m-d H:i:s', time() - $pollingIntervalS);
    global $tableName;
    $mySqli = connectToDB();
    $queryStatement = "SELECT * FROM " . $tableName . " WHERE date_time > '" . $tMinusTen . "'";
    $result = $mySqli->query($queryStatement);    
    $mySqli->close();
    $faceArr = convertSqlResultToArray($result);
    $assArr = array_map(function($a) { return get_object_vars($a);}, $faceArr);
    
    print json_encode($assArr);
}

date_default_timezone_set('Etc/GMT-8');

if($_POST['action'] == 'save_data')
{
    saveData();
}
else if($_POST['action'] == 'load_data')
{
    fetchData();
}
else if($_POST['action'] == 'get_new_faces')
{
    getNewRows($_POST['polling_interval']);
}
else if($_POST['action'] == 'add_batch')
{
    loadBatchToDir();
}