const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');

async function convertPngToIco() {
  try {
    const pngPath = path.join(__dirname, 'public', 'images', 'AnySonus1.png');
    const resizedPngPath = path.join(__dirname, 'build', 'resized-icon.png');
    const icoOutputPath = path.join(__dirname, 'build', 'icon.ico');
    
    // 确保build目录存在
    if (!fs.existsSync(path.join(__dirname, 'build'))) {
      fs.mkdirSync(path.join(__dirname, 'build'), { recursive: true });
    }
    
    // 使用sharp调整图像大小
    await sharp(pngPath)
      .resize(256, 256)
      .toFile(resizedPngPath);
    
    console.log('图像已调整大小并保存到:', resizedPngPath);
    
    // 转换PNG到ICO
    const icoBuffer = await pngToIco([resizedPngPath]);
    
    // 写入文件
    fs.writeFileSync(icoOutputPath, icoBuffer);
    
    console.log('转换完成！ICO文件已保存到:', icoOutputPath);
  } catch (error) {
    console.error('转换图标时出错:', error);
  }
}

convertPngToIco(); 