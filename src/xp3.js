globalThis.XP3JS_CACHE = {};

function getDataWithRange(path, begin, len)
{
    return fetch(path, {
        method: 'GET',
        headers: {
            'Range': `bytes=${begin}-${(len === undefined)?'':begin + len - 1}`
        }
    }).then(response => {
        if(!response.ok) throw new Error('Fetch failed');
        return response.arrayBuffer();
    }).then(buf => new Uint8Array(buf));
}

async function loadXp3Header(path)
{
    if(!XP3JS_CACHE[path]) XP3JS_CACHE[path] = {};
    if(!XP3JS_CACHE[path]['header']) {
        const header = {};
        const headerPart1 = await getDataWithRange(path, 0, 19);

        header['header1'] = headerPart1.slice(0, 8);    // 58 50 33 0d 0a 20 0a 1a
        if(!compareArray(header['header1'], [0x58, 0x50, 0x33, 0x0d, 0x0a, 0x20, 0x0a, 0x1a])) throw new Error('Invalid header1');

        header['header2'] = headerPart1.slice(8, 11);   // 8b 67 01
        if(!compareArray(header['header2'], [0x8b, 0x67, 0x01])) throw new Error('Invalid header2');

        const tmpIndex = headerPart1.slice(11, 19);

        if(compareArray(tmpIndex, [0x17, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])) {
            // 吉里吉里2.30-
            const headerPart2 = await getDataWithRange(path, 19, 21);

            header['headerSize'] = 40;

            header['cushionIndex'] = tmpIndex;

            header['headerMinorVersion'] = headerPart2.slice(0, 4);

            header['cushionHeader'] = headerPart2.slice(4, 5);  // 80
            if(!compareArray(header['cushionHeader'], [0x80])) throw new Error('Invalid cusionHeader');

            header['indexSize'] = headerPart2.slice(5, 13); // 00 00 00 00 00 00 00 00

            header['fileIndex'] = headerPart2.slice(13, 21);
        } else {
            // -吉里吉里2.28

            header['headerSize'] = 19;

            header['fileIndex'] = tmpIndex;
        }
        header['fileIndexValue'] = uint8ToUint32(header['fileIndex']);  // TODO: ちゃんと8bytes読むようにする
        XP3JS_CACHE[path]['header'] = header;
    }
    return XP3JS_CACHE[path]['header'];
}

async function loadXp3Files(path)
{
    if(!XP3JS_CACHE[path]) XP3JS_CACHE[path] = {};
    if(!XP3JS_CACHE[path]['files']) {
        const header = await loadXp3Header(path);
        const files = {};
        const filesData = await getDataWithRange(path, header.fileIndexValue);

        files['isFilesCompressed'] = (filesData[0] === 0x01);
        files['filesRealSize'] = filesData.slice(1, 9);
        files['filesRealSizeValue'] = uint8ToUint32(files['filesRealSize']);
        if(files['isFilesCompressed']) {
            files['filesSize'] = filesData.slice(9, 17);
            files['filesSizeValue'] = uint8ToUint32(files['filesSize']);
        } else {
            files['filesSize'] = files['filesRealSize'];
            files['filesSizeValue'] = files['filesRealSizeValue'];
        }

        let filesArrayData = filesData.slice(files['isFilesCompressed']?17:9);
        if(files['isFilesCompressed']) {
            filesArrayData = new Zlib.Inflate(filesArrayData).decompress();
        }

        files['fileEntries'] = [];

        let filesOffset = 0;
        while(files['filesSizeValue'] > filesOffset) {
            const entryMagic = filesArrayData.slice(filesOffset, filesOffset + 4);
            const entrySize = filesArrayData.slice(filesOffset + 4, filesOffset + 12);
            const entrySizeValue = uint8ToUint32(entrySize);

            if(compareArray(entryMagic, [0x46, 0x69, 0x6c, 0x65])) {
                // File
                const entry = {};

                entry['fileMagic'] = entryMagic;
                entry['entrySize'] = entrySize;
                entry['entrySizeValue'] = entrySizeValue;

                let entryOffset = filesOffset + 12;
                while((entryOffset - filesOffset - 12) < entrySizeValue) {
                    const sectionMagic = filesArrayData.slice(entryOffset, entryOffset + 4);
                    const sectionSize = filesArrayData.slice(entryOffset + 4, entryOffset + 12);
                    const sectionSizeValue = uint8ToUint32(sectionSize);
                    if(compareArray(sectionMagic, [0x69, 0x6e, 0x66, 0x6f])) {
                        // info
                        entry['infoMagic'] = sectionMagic;
                        entry['infoSize'] = sectionSize;
                        entry['infoSizeValue'] = sectionSizeValue;

                        entry['infoFlag'] = filesArrayData.slice(entryOffset + 12, entryOffset + 16);
                        entry['infoFlagValue'] = uint8ToUint32(entry['infoFlag']);
                        entry['infoFlags'] = {
                            protect: (entry['infoFlagValue'] & (0x01 << 31)) !== 0
                        };

                        entry['infoFileSize'] = filesArrayData.slice(entryOffset + 16, entryOffset + 24);
                        entry['infoFileSizeValue'] = uint8ToUint32(entry['infoFileSize']);

                        entry['infoRealFileSize'] = filesArrayData.slice(entryOffset + 24, entryOffset + 32);
                        entry['infoRealFileSizeValue'] = uint8ToUint32(entry['infoRealFileSize']);

                        entry['infoFileNameLength'] = filesArrayData.slice(entryOffset + 32, entryOffset + 34);
                        entry['infoFileNameLengthValue'] = uint8ToUint16(entry['infoFileNameLength']);

                        entry['infoFileName'] = filesArrayData.slice(entryOffset + 34, entryOffset + 34 + entry['infoFileNameLengthValue'] * 2);
                        entry['infoFileNameValue'] = uint8WcharToString(entry['infoFileName']);
                    } else if(compareArray(sectionMagic, [0x73, 0x65, 0x67, 0x6d])) {
                        // segm
                        entry['segmMagic'] = sectionMagic;
                        entry['segmSize'] = sectionSize;
                        entry['segmSizeValue'] = sectionSizeValue;

                        entry['segments'] = [];

                        const segmentCount = sectionSizeValue / 28;
                        for(let i = 0; i < segmentCount; i++) {
                            const segment = {};

                            segment['flag'] = filesArrayData.slice(entryOffset + 12 + 28 * i, entryOffset + 12 + 28 * i + 4);
                            segment['flagValue'] = uint8ToUint32(segment['flag']);
                            segment['flags'] = {
                                compressed: (segment['flagValue'] & (0x01 << 0)) !== 0
                            };

                            segment['offset'] = filesArrayData.slice(entryOffset + 12 + 28 * i + 4, entryOffset + 12 + 28 * i + 12);
                            segment['offsetValue'] = uint8ToUint32(segment['offset']);

                            segment['size'] = filesArrayData.slice(entryOffset + 12 + 28 * i + 12, entryOffset + 12 + 28 * i + 20);
                            segment['sizeValue'] = uint8ToUint32(segment['size']);

                            segment['realSize'] = filesArrayData.slice(entryOffset + 12 + 28 * i + 20, entryOffset + 12 + 28 * i + 28);
                            segment['realSizeValue'] = uint8ToUint32(segment['realSize']);

                            entry['segments'].push(segment);
                        }
                    } else if(compareArray(sectionMagic, [0x61, 0x64, 0x6c, 0x72])) {
                        // adlr
                        entry['adlrMagic'] = sectionMagic;
                        entry['adlrSize'] = sectionSize;
                        entry['adlrSizeValue'] = sectionSizeValue;

                        entry['adlrChecksum'] = filesArrayData.slice(entryOffset + 12, entryOffset + 16);
                        entry['adlrChecksumValue'] = uint8ToUint32(entry['adlrChecksum']);
                    } else {
                        console.warn(`Found unknown section: ${Array.from(sectionMagic).map(n => String.fromCharCode(n)).join('')} (${Array.from(sectionMagic).map(n => n.toString(16).padStart(2, '0')).join(' ')})`, filesArrayData.slice(entryOffset, entryOffset + 12 + sectionSizeValue));
                    }

                    entryOffset += 12 + sectionSizeValue;
                }

                entry['_fileName'] = entry['infoFileNameValue'];

                files['fileEntries'].push(entry);
            } else {
                console.warn(`Found unknown entry: ${Array.from(entryMagic).map(n => String.fromCharCode(n)).join('')} (${Array.from(entryMagic).map(n => n.toString(16).padStart(2, '0')).join(' ')})`, filesArrayData.slice(filesOffset, filesOffset + 12 + entrySizeValue));
            }

            filesOffset += 12 + entrySizeValue;
        }
        XP3JS_CACHE[path]['files'] = files;
    }
    return XP3JS_CACHE[path]['files'];
}

async function getXp3File(archive, path) {
    const meta = await loadXp3Files(archive);
    for(const entry of meta.fileEntries) {
        let fileName = entry['_fileName'];
        if(fileName !== path) continue;

        if(entry.segments.length !== 1) throw new Error('Multi segmented files are not supported.');

        let content = await getDataWithRange(archive, entry.segments[0].offsetValue, entry.segments[0].realSizeValue);
        if(entry.segments[0].flags.compressed) {
            content = new Zlib.Inflate(content).decompress();
        }

        return content;
    }
}

function compareArray(a, b)
{
    if (a.length !== b.length) return false;
    const len = a.length;

    for (let i = 0; i < len; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function uint8ToUint16(arr, offset = 0) {
    return arr[offset] << 0 | arr[offset + 1] << 8;
}

function uint8ToUint32(arr, offset = 0) {
    return arr[offset] << 0 | arr[offset + 1] << 8 | arr[offset + 2] << 16 | arr[offset + 3] << 24;
}

function uint8WcharToString(arr, offset = 0) {
    const bytes = arr.length - offset;
    let res = ''
    for(let i = offset; i < bytes; i += 2) {
        if(0xd8 <= arr[i + 1] && arr[i + 1] <= 0xdb) {
            res += String.fromCharCode(arr[i] << 0 | arr[i + 1] << 8, arr[i + 2] << 0 | arr[i + 3] << 8)
            i += 2;
        } else {
            res += String.fromCharCode(arr[i] << 0 | arr[i + 1] << 8);
        }
    }
    return res;
}
