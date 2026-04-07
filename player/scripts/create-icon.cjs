/**
 * create-icon.js
 * SignFlow Player 아이콘 생성 스크립트
 * 순수 Node.js Buffer로 ICO 파일 생성 (외부 의존성 없음)
 */

const fs = require('fs')
const path = require('path')

const publicDir = path.join(__dirname, '../public')
fs.mkdirSync(publicDir, { recursive: true })

/**
 * 32x32 BGRA 픽셀 배열 생성 (SignFlow 로고 스타일: 네이비 배경 + 흰 S)
 */
function createPixels(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const r = size / 2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      // 배경: 둥근 네이비 (#1E3A5F)
      if (dist <= r - 1) {
        // 'S' 글자 그리기 (단순 픽셀 근사)
        const nx = (x / size) * 10 - 5  // -5 ~ 5
        const ny = (y / size) * 10 - 5  // -5 ~ 5

        // S 자 형태: 상단 가로줄, 중단 가로줄, 하단 가로줄 + 연결
        const isS = (
          (ny >= -4 && ny <= -2.5 && nx >= -2 && nx <= 2) ||  // 상단 가로
          (ny >= -4 && ny <= 0 && nx >= -2 && nx <= -0.5) ||  // 상단 좌측 세로
          (ny >= -1.5 && ny <= 0.5 && nx >= -2 && nx <= 2) || // 중단 가로
          (ny >= 0 && ny <= 4 && nx >= 0.5 && nx <= 2) ||     // 하단 우측 세로
          (ny >= 2.5 && ny <= 4 && nx >= -2 && nx <= 2)       // 하단 가로
        )

        if (isS) {
          // 흰색 (BGRA)
          pixels[idx + 0] = 255
          pixels[idx + 1] = 255
          pixels[idx + 2] = 255
          pixels[idx + 3] = 255
        } else {
          // 네이비 (#1E3A5F → B=0x5F, G=0x3A, R=0x1E)
          pixels[idx + 0] = 0x5F
          pixels[idx + 1] = 0x3A
          pixels[idx + 2] = 0x1E
          pixels[idx + 3] = 255
        }
      } else {
        // 바깥: 투명
        pixels[idx + 0] = 0
        pixels[idx + 1] = 0
        pixels[idx + 2] = 0
        pixels[idx + 3] = 0
      }
    }
  }
  return pixels
}

/**
 * ICO 파일 생성
 * sizes: 여러 해상도를 포함 (16, 32, 48, 256)
 */
function createIco(sizes) {
  const images = sizes.map((size) => {
    const pixels = createPixels(size)

    // BMP DIB 헤더 (40 bytes)
    const dibHeader = Buffer.alloc(40)
    dibHeader.writeUInt32LE(40, 0)           // header size
    dibHeader.writeInt32LE(size, 4)          // width
    dibHeader.writeInt32LE(size * 2, 8)      // height * 2 (XOR + AND mask)
    dibHeader.writeUInt16LE(1, 12)           // planes
    dibHeader.writeUInt16LE(32, 14)          // bit count (32bpp BGRA)
    dibHeader.writeUInt32LE(0, 16)           // compression (BI_RGB)
    dibHeader.writeUInt32LE(0, 20)           // image size (0 for BI_RGB)
    dibHeader.writeInt32LE(0, 24)            // X pixels/meter
    dibHeader.writeInt32LE(0, 28)            // Y pixels/meter
    dibHeader.writeUInt32LE(0, 32)           // colors used
    dibHeader.writeUInt32LE(0, 36)           // colors important

    // AND 마스크 (완전 불투명)
    const maskRowSize = Math.ceil(size / 32) * 4
    const andMask = Buffer.alloc(size * maskRowSize, 0)

    // 픽셀 데이터는 상하 반전 (BMP 형식)
    const flippedPixels = Buffer.alloc(pixels.length)
    for (let y = 0; y < size; y++) {
      const src = y * size * 4
      const dst = (size - 1 - y) * size * 4
      pixels.copy(flippedPixels, dst, src, src + size * 4)
    }

    const imageData = Buffer.concat([dibHeader, flippedPixels, andMask])
    return { size, imageData }
  })

  // ICO 헤더 (6 bytes)
  const icoHeader = Buffer.alloc(6)
  icoHeader.writeUInt16LE(0, 0)              // reserved
  icoHeader.writeUInt16LE(1, 2)              // type (1 = ICO)
  icoHeader.writeUInt16LE(images.length, 4)  // image count

  // 디렉토리 엔트리 (16 bytes × 이미지 수)
  const dirSize = images.length * 16
  const dataOffset = 6 + dirSize
  let currentOffset = dataOffset

  const directories = images.map(({ size, imageData }) => {
    const dir = Buffer.alloc(16)
    dir.writeUInt8(size >= 256 ? 0 : size, 0)  // width (0 = 256)
    dir.writeUInt8(size >= 256 ? 0 : size, 1)  // height
    dir.writeUInt8(0, 2)                        // color count (0 = TrueColor)
    dir.writeUInt8(0, 3)                        // reserved
    dir.writeUInt16LE(1, 4)                     // planes
    dir.writeUInt16LE(32, 6)                    // bit count
    dir.writeUInt32LE(imageData.length, 8)      // data size
    dir.writeUInt32LE(currentOffset, 12)        // data offset
    currentOffset += imageData.length
    return dir
  })

  return Buffer.concat([
    icoHeader,
    ...directories,
    ...images.map((i) => i.imageData),
  ])
}

// ICO 생성 (16, 32, 48, 256 px)
const icoBuffer = createIco([16, 32, 48, 256])
const icoPath = path.join(publicDir, 'icon.ico')
fs.writeFileSync(icoPath, icoBuffer)
console.log(`✅ icon.ico 생성: ${icoPath} (${(icoBuffer.length / 1024).toFixed(1)} KB)`)

// PNG 생성 (Linux용 — 최소 PNG 헤더 + 단색 이미지)
// electron-builder Linux용으로 512x512 PNG가 필요하지만 여기서는 간단히 ICO에서 추출 불가하므로
// 간단한 PNG 생성 (순수 Node.js)
function createMinimalPNG(size) {
  // PNG 시그니처
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  function crc32(buf) {
    let crc = 0xFFFFFFFF
    const table = []
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
      table[i] = c
    }
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
    return (crc ^ 0xFFFFFFFF) >>> 0
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii')
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length, 0)
    const crcInput = Buffer.concat([typeBytes, data])
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crc32(crcInput), 0)
    return Buffer.concat([len, typeBytes, data, crcBuf])
  }

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)  // width
  ihdr.writeUInt32BE(size, 4)  // height
  ihdr.writeUInt8(8, 8)        // bit depth
  ihdr.writeUInt8(2, 9)        // color type (RGB)
  ihdr.writeUInt8(0, 10)       // compression
  ihdr.writeUInt8(0, 11)       // filter
  ihdr.writeUInt8(0, 12)       // interlace

  // IDAT (raw scanlines — zlib compressed)
  const zlib = require('zlib')
  const scanlines = Buffer.alloc(size * (1 + size * 3))
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3)
    scanlines[row] = 0  // filter type: None
    for (let x = 0; x < size; x++) {
      const px = row + 1 + x * 3
      const cx = size / 2, cy = size / 2
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (dist <= size / 2 - 1) {
        scanlines[px + 0] = 0x1E  // R
        scanlines[px + 1] = 0x3A  // G
        scanlines[px + 2] = 0x5F  // B
      } else {
        scanlines[px + 0] = 0x10
        scanlines[px + 1] = 0x10
        scanlines[px + 2] = 0x10
      }
    }
  }
  const compressed = zlib.deflateSync(scanlines)

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const pngBuffer = createMinimalPNG(512)
const pngPath = path.join(publicDir, 'icon.png')
fs.writeFileSync(pngPath, pngBuffer)
console.log(`✅ icon.png 생성: ${pngPath} (${(pngBuffer.length / 1024).toFixed(1)} KB)`)
console.log('')
console.log('💡 실제 배포 전에 public/icon.ico 와 public/icon.png 를 실제 로고 이미지로 교체하세요.')
