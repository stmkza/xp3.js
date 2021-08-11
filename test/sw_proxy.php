<?php
/* ServiceWorkerのパス制限を回避するためsw.jsをプロキシするスクリプト */
header('Content-Type: text/javascript');
readfile(__DIR__ . '/../src/sw.js');
