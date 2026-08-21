SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

CREATE TABLE `faces` 
(
    `id` int(10) NOT NULL AUTO_INCREMENT,
    `image_url` varchar(100) NOT NULL,
    `audio_url` varchar(100),
    PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

----

UPDATE faces 
	SET image_url = replace(image_url, "C:xampphtdocswebsitefacessrc/", "..");
UPDATE faces
	SET audio_url = replace(audio_url, "C:xampphtdocswebsitefacessrc/", "..");
UPDATE faces
	SET image_url = replace(image_url, "C:xampphtdocswebsitefaces", "..");
UPDATE faces
	SET audio_url = replace(audio_url, "C:xampphtdocswebsitefaces", "..");