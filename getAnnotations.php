<?php
$dbhost = "localhost";
$dbuser = "root";
$dbpass = "password";
$dbname = "Annotation_Database";
$imageId = $_GET['imageId'];

	//Connect to MySQL Server
mysql_connect($dbhost, $dbuser, $dbpass);
	//Select Database
mysql_select_db($dbname) or die(mysql_error());
	//build query
$query = "SELECT * FROM annotation WHERE imageid=$imageId";

	//Execute query
$qry_result = mysql_query($query) or die(mysql_error());
while($r = mysql_fetch_assoc($qry_result)) {
   $rows[] = $r;
}
print json_encode($rows);
?>