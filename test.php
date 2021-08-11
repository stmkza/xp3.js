<?php
/* HTTP Rangeリクエストに(一部)対応したサーバ
 * PHP Built-in Web Server で使うことを想定しています
 * 
 * /test.php?file=test1.xp3 で DATA_DIR/test1.xp3 を返します。ファイルパス中のディレクトリは無視されます。
 */

define('DATA_DIR', __DIR__ . '/test/');
define('RANGE_CHUNK_SIZE', 4096);

if(!isset($_GET['file'])) {
    http_response_code(400);
    die('Parameter `file` is not given.');
}

$file = DATA_DIR . basename($_GET['file']);

if(!file_exists($file)) {
    http_response_code(404);
    die('File not found.');
}

header('Content-Type: application/octet-stream');

$fileSize = filesize($file);

if(empty($_SERVER['HTTP_RANGE'])) {
    header('Accept-Ranges: bytes');
    header(sprintf('Content-Length: %d', $fileSize));
    readfile($file);
    exit();
} else {
    [$sizeUnit, $ranges] = explode('=', $_SERVER['HTTP_RANGE'], 2);
    if($sizeUnit !== 'bytes') {
        http_response_code(416);
        exit();
    }
    if(count(explode(' ', $ranges)) > 1) {
        header('Accept-Ranges: none');
        readfile($file);
        exit();
    } else {
        [$start, $end] = explode('-', $ranges);
        if(isset($start) && $start !== '' && isset($end) && $end !== '') {
            $start = max((int) $start, 0);
            $end = min((int) $end, $fileSize - 1);
        } else if(isset($start) && $start !== '') {
            $start = max((int) $start, 0);
            $end = $fileSize - 1;
        } else if(isset($end) && $end !== '') {
            $start = max($fileSize - (int) $end, 0);
            $end = $fileSize - 1;
        } else {
            http_response_code(416);
            exit();
        }
        if($start > $end) {
            http_response_code(416);
            exit();
        }
        header('Accept-Ranges: bytes');
        if(0 < $start || $end < $fileSize - 1) {
            http_response_code(206);
            header(sprintf('Content-Range: bytes %d-%d/%d', $start, $end, $fileSize));
        }
        header(sprintf('Content-Length: %d', $end - $start + 1));

        $fp = fopen($file, 'rb');
        $currentPos = $start;
        fseek($fp, $currentPos);
        while($currentPos <= $end && !feof($fp)) {
            $seekLen = min(RANGE_CHUNK_SIZE, $end - $currentPos + 1);
            echo fread($fp, $seekLen);
            $currentPos += $seekLen;
        }
        fclose($fp);
    }
}