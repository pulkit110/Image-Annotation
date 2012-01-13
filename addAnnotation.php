<?php
$dbhost = "localhost";
$dbuser = "root";
$dbpass = "password";
$dbname = "Annotation_Database";
//Connect to MySQL Server
mysql_connect($dbhost, $dbuser, $dbpass);
//Select Database
mysql_select_db($dbname) or die(mysql_error());
$x = $_POST['x'];
$y = $_POST['y'];
$text = $_POST['text'];
$imageId = $_POST['imageId'];
print $x;
print $y;
print $text;
//build query
$query = "INSERT INTO annotation (x, y, text, imageid) VALUES ($x, $y, '$text', $imageId)";

//Execute query
$qry_result = mysql_query($query) or die(mysql_error());
?>