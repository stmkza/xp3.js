const XP3_CACHE_VERSION = 1;
const XP3JS_BASE_PATH = '/src/';
const XP3JS_DATA_BASE_PATH = '/data/file.php?name=';

importScripts(`${XP3JS_BASE_PATH}inflate.js`);
importScripts(`${XP3JS_BASE_PATH}xp3.js`);
importScripts(`${XP3JS_BASE_PATH}encoding.min.js`);

async function responseXp3File(archive, path)
{
    const buf = await getXp3File(archive, path);
    let contentType = 'application/octet-stream';
    const extension = path.split('.').pop().toLowerCase();
    switch(extension) {
        case 'txt':
        case 'tjs':
        case 'ks':
            const charset = ({
                'UTF32': 'UTF-32',
                'UTF16': 'UTF-16',
                'UTF16BE': 'UTF-16BE',
                'UTF16LE': 'UTF-16LE',
                'BINARY': null,
                'ASCII': 'US-ASCII',
                'JIS': 'ISO-2022-JP',
                'UTF8': 'UTF-8',
                'EUCJP': 'EUC-JP',
                'SJIS': 'Shift_JIS',
            })[Encoding.detect(utf8Array)];
            if(charset) contentType = `text/plain;charset=${charset}`;
            break;
        case 'png':
            contentType = 'image/png';
            break;
        case 'jpg':
        case 'jpeg':
            contentType = 'image/jpeg';
            break;
        case 'gif':
            contentType = 'image/gif';
            break;
        case 'mp4':
            contentType = 'video/mp4';
            break;
    }

    return new Response(new Blob([buf]), {headers: {
        'Content-Type': contentType,
    }});
}

self.addEventListener('install', event => {
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', function(event) {
    const url = new URL(event.request.url);
    if(!url.pathname.startsWith(`${XP3JS_BASE_PATH}.vfs/xp3/`)) return;
    const requestedPath = decodeURIComponent(url.pathname).substring(`${XP3JS_BASE_PATH}.vfs/xp3/`.length);
    const delimiterIndex = requestedPath.indexOf('>');
    if(delimiterIndex === -1) return;
    const [archive, path] = [requestedPath.substring(0, delimiterIndex), requestedPath.substring(delimiterIndex + 1)];
    event.respondWith(
        caches.open(`xp3js-v${XP3_CACHE_VERSION}`).then(cache => cache.match(event.request).then(response => {
            if(response) return response;
            else return responseXp3File(XP3JS_DATA_BASE_PATH + archive, path).then(response => {
                cache.put(event.request.url, response.clone());
                return response;
            });
        }))
    );
});
