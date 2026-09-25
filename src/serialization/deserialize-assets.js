const JSZip = require('@turbowarp/jszip');
const log = require('../util/log');
const AsyncLimiter = require('../util/async-limiter');

// Inflating every asset of a large project at the same time can spike memory
// usage significantly. JSZip's inflate runs on the single main thread anyway,
// so limiting concurrency barely affects total load time while keeping peak
// memory low.
// We increased from 8 to 16 as modern browsers handle this well, and the
// I/O overhead of reading zip entries benefits from higher concurrency even
// if the actual inflate is single-threaded.
const readZipEntry = new AsyncLimiter(entry => entry.async('uint8array'), 16);

// Standard Scratch asset file names are "<32 hex char md5>.<ext>". When that is
// the case the md5 in the name is already the content hash, so we can skip
// recomputing the md5 over the (potentially large) asset data.
const MD5_REGEX = /^[0-9a-f]{32}$/i;
const getKnownMd5 = fileName => {
    const dot = fileName.indexOf('.');
    const prefix = dot === -1 ? fileName : fileName.substring(0, dot);
    return MD5_REGEX.test(prefix) ? prefix : null;
};

// A single asset can be referenced by several sprites. JSZip otherwise
// inflates it, hashes it, and creates the same storage asset once per reference.
// Key first by storage so a zip reused with another runtime cannot return an
// asset created by an incompatible storage instance. Weak keys allow both
// levels to disappear after loading.
const assetPromises = new WeakMap();

const createAssetOnce = function (file, storage, assetType, dataFormat, assetId, generateId) {
    let byFile = assetPromises.get(storage);
    if (!byFile) {
        byFile = new WeakMap();
        assetPromises.set(storage, byFile);
    }
    let byType = byFile.get(file);
    if (!byType) {
        byType = new Map();
        byFile.set(file, byType);
    }
    const assetTypeName = assetType && assetType.name ? assetType.name : String(assetType);
    const key = `${assetTypeName}\0${dataFormat}\0${assetId || ''}\0${generateId ? '1' : '0'}`;
    let promise = byType.get(key);
    if (!promise) {
        promise = file.async('uint8array')
            .then(data => storage.createAsset(assetType, dataFormat, data, assetId, generateId));
        byType.set(key, promise);
        promise.catch(() => {
            if (byType.get(key) === promise) byType.delete(key);
        });
    }
    return promise;
};

/**
 * Deserializes sound from file into storage cache so that it can
 * be loaded into the runtime.
 * @param {object} sound Descriptor for sound from sb3 file
 * @param {Runtime} runtime The runtime containing the storage to cache the sounds in
 * @param {JSZip} zip The zip containing the sound file being described by `sound`
 * @param {string} assetFileName Optional file name for the given asset
 * (sb2 files have filenames of the form [int].[ext],
 * sb3 files have filenames of the form [md5].[ext])
 * @return {Promise} Promise that resolves after the described sound has been stored
 * into the runtime storage cache, the sound was already stored, or an error has
 * occurred.
 */
const deserializeSound = function (sound, runtime, zip, assetFileName) {
    const fileName = assetFileName ? assetFileName : sound.md5;
    const storage = runtime.storage;
    if (!storage) {
        log.warn('No storage module present; cannot load sound asset: ', fileName);
        return Promise.resolve(null);
    }

    if (!zip) { // Zip will not be provided if loading project json from server
        return Promise.resolve(null);
    }

    let soundFile = zip.file(fileName);
    if (!soundFile) {
        // look for assetfile in a flat list of files, or in a folder
        const fileMatch = new RegExp(`^([^/]*/)?${fileName}$`);
        soundFile = zip.file(fileMatch)[0]; // use first matching file
    }

    if (!soundFile) {
        log.error(`Could not find sound file associated with the ${sound.name} sound.`);
        return Promise.resolve(null);
    }

    if (!JSZip.support.uint8array) {
        log.error('JSZip uint8array is not supported in this browser.');
        return Promise.resolve(null);
    }

    const requestedFormat = sound.dataFormat.toLowerCase();
    let dataFormat = storage.DataFormat.WAV;
    if (requestedFormat === 'mp3') {
        dataFormat = storage.DataFormat.MP3;
    } else if (requestedFormat === 'ogg') {
        dataFormat = storage.DataFormat.OGG || 'ogg';
    }
    // The file name prefix is the content md5 for standard assets, so we can
    // skip recomputing the md5 over the sound data.
    const knownMd5 = getKnownMd5(fileName);
    return readZipEntry.do(soundFile).then(data => storage.createAsset(
        storage.AssetType.Sound,
        dataFormat,
        data,
        knownMd5,
        !knownMd5
    ))
        .then(asset => {
            sound.asset = asset;
            sound.assetId = asset.assetId;
            sound.md5 = `${asset.assetId}.${asset.dataFormat}`;
        });
};

/**
 * Deserializes costume from file into storage cache so that it can
 * be loaded into the runtime.
 * @param {object} costume Descriptor for costume from sb3 file
 * @param {Runtime} runtime The runtime containing the storage to cache the costumes in
 * @param {JSZip} zip The zip containing the costume file being described by `costume`
 * @param {string} assetFileName Optional file name for the given asset
 * (sb2 files have filenames of the form [int].[ext],
 * sb3 files have filenames of the form [md5].[ext])
 * @param {string} textLayerFileName Optional file name for the given asset's text layer
 * (sb2 only; files have filenames of the form [int].png)
 * @return {Promise} Promise that resolves after the described costume has been stored
 * into the runtime storage cache, the costume was already stored, or an error has
 * occurred.
 */
const deserializeCostume = function (costume, runtime, zip, assetFileName, textLayerFileName) {
    const storage = runtime.storage;
    const assetId = costume.assetId;
    const fileName = assetFileName ? assetFileName :
        `${assetId}.${costume.dataFormat}`;

    if (!storage) {
        log.warn('No storage module present; cannot load costume asset: ', fileName);
        return Promise.resolve(null);
    }

    if (costume.asset) {
        // When uploading a sprite from an image file, the asset data will be provided
        // @todo Cache the asset data somewhere and pull it out here
        const assetData = costume.asset.data;
        let bytes;
        if (assetData instanceof ArrayBuffer) {
            // Copy, like the generic path below, so the asset owns its data.
            bytes = new Uint8Array(assetData.slice(0));
        } else if (ArrayBuffer.isView(assetData)) {
            // `new Uint8Array(typedArray)` copies, avoiding the temporary
            // array that Object.keys().map() used to build.
            bytes = new Uint8Array(assetData);
        } else {
            bytes = new Uint8Array(Object.values(assetData));
        }
        return Promise.resolve(storage.createAsset(
            costume.asset.assetType,
            costume.asset.dataFormat,
            bytes,
            null,
            true
        )).then(asset => {
            costume.asset = asset;
            costume.assetId = asset.assetId;
            costume.md5 = `${asset.assetId}.${asset.dataFormat}`;
        });
    }

    if (!zip) {
        // Zip will not be provided if loading project json from server
        return Promise.resolve(null);
    }

    let costumeFile = zip.file(fileName);
    if (!costumeFile) {
        // look for assetfile in a flat list of files, or in a folder
        const fileMatch = new RegExp(`^([^/]*/)?${fileName}$`);
        costumeFile = zip.file(fileMatch)[0]; // use the first matched file
    }

    if (!costumeFile) {
        log.error(`Could not find costume file associated with the ${costume.name} costume.`);
        return Promise.resolve(null);
    }
    let assetType = null;
    const costumeFormat = costume.dataFormat.toLowerCase();
    if (costumeFormat === 'svg') {
        assetType = storage.AssetType.ImageVector;
    } else if (['png', 'bmp', 'jpeg', 'jpg', 'gif'].indexOf(costumeFormat) >= 0) {
        assetType = storage.AssetType.ImageBitmap;
    } else {
        log.error(`Unexpected file format for costume: ${costumeFormat}`);
    }
    if (!JSZip.support.uint8array) {
        log.error('JSZip uint8array is not supported in this browser.');
        return Promise.resolve(null);
    }

    // textLayerMD5 exists if there is a text layer, which is a png of text from Scratch 1.4
    // that was opened in Scratch 2.0. In this case, set costume.textLayerAsset.
    let textLayerFilePromise;
    if (costume.textLayerMD5) {
        const textLayerFile = zip.file(textLayerFileName);
        if (!textLayerFile) {
            log.error(`Could not find text layer file associated with the ${costume.name} costume.`);
            return Promise.resolve(null);
        }
        textLayerFilePromise = createAssetOnce(
            textLayerFile,
            storage,
            storage.AssetType.ImageBitmap,
            'png',
            costume.textLayerMD5,
            false
        )
            .then(asset => {
                costume.textLayerAsset = asset;
            });
    } else {
        textLayerFilePromise = Promise.resolve(null);
    }

    // The file name prefix is the content md5 for standard assets, so we can
    // skip recomputing the md5 over the image data.
    const knownMd5 = getKnownMd5(fileName);
    return Promise.all([textLayerFilePromise,
        readZipEntry.do(costumeFile)
            .then(data => storage.createAsset(
                assetType,
                // TODO eventually we want to map non-png's to their actual file types?
                costumeFormat,
                data,
                knownMd5,
                !knownMd5
            ))
            .then(asset => {
                costume.asset = asset;
                costume.assetId = asset.assetId;
                costume.md5 = `${asset.assetId}.${asset.dataFormat}`;
            })
    ]);
};

module.exports = {
    deserializeSound,
    deserializeCostume
};
