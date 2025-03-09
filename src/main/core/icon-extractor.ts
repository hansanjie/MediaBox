import { app, nativeImage } from 'electron';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

// 使用 PowerShell 提取图标的脚本
const extractIconScript = `
Add-Type -AssemblyName System.Drawing

function Extract-Icon {
    param([string]$exePath, [string]$savePath)
    
    try {
        $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($exePath)
        if ($icon -ne $null) {
            $bitmap = $icon.ToBitmap()
            $bitmap.Save($savePath, [System.Drawing.Imaging.ImageFormat]::Png)
            $bitmap.Dispose()
            $icon.Dispose()
            return $true
        }
    } catch {
        Write-Error $_.Exception.Message
        return $false
    }
    return $false
}

$success = Extract-Icon -exePath '$exePath' -savePath '$outputPath'
if ($success) { Write-Output "success" } else { Write-Output "failed" }
`;

// 检查是否为系统默认图标
function isSystemDefaultIcon(icon: Electron.NativeImage, isElectronApp: boolean = false): boolean {
  const base64Data = icon.toDataURL();
  const dimensions = icon.getSize();
  
  // 对于 Electron 应用使用更严格的判断
  if (isElectronApp) {
    return base64Data.length < 2000 || (dimensions.width === 32 && dimensions.height === 32);
  }
  
  // 对于普通应用，只有当图标数据异常短时才认为是系统图标
  return base64Data.length < 500;
}



export async function extractExeIcon(filePath: string): Promise<string | null> {
  try {
    console.log('开始提取图标，文件路径:', filePath);
    
    if (!existsSync(filePath)) {
      console.error('文件不存在:', filePath);
      return null;
    }

    // 使用 PowerShell 提取图标
    try {
      const tempDir = app.getPath('temp');
      const iconPath = join(tempDir, `icon_${Date.now()}.png`);
      
      const script = extractIconScript
        .replace('$exePath', filePath.replace(/'/g, "''"))
        .replace('$outputPath', iconPath.replace(/'/g, "''"));
      
      console.log('执行 PowerShell 脚本...');
      const { stdout, stderr } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${script}"`);
      console.log('PowerShell 输出:', stdout);
      if (stderr) console.error('PowerShell 错误:', stderr);
      
      if (existsSync(iconPath)) {
        console.log('图标文件已创建');
        const icon = nativeImage.createFromPath(iconPath);
        
        if (!icon.isEmpty()) {
          console.log('成功加载图标');
          const resizedIcon = icon.resize({
            width: 48,
            height: 48,
            quality: 'best'
          });
          
          const result = resizedIcon.toDataURL();
          require('fs').unlinkSync(iconPath);
          console.log('图标提取成功');
          return result;
        } else {
          console.log('加载的图标为空');
        }
        
        require('fs').unlinkSync(iconPath);
      } else {
        console.log('图标文件未创建');
      }
    } catch (error) {
      console.error('PowerShell 提取图标失败:', error);
    }

    // 如果 PowerShell 方法失败，尝试使用 Electron 的方法
    try {
      console.log('尝试使用 Electron 方法...');
      const icon = await app.getFileIcon(filePath, { size: 'large' });
      
      if (!icon.isEmpty()) {
        console.log('Electron 方法成功获取图标');
        const resizedIcon = icon.resize({
          width: 48,
          height: 48,
          quality: 'best'
        });

        return resizedIcon.toDataURL();
      }
    } catch (error) {
      console.error('Electron 提取图标失败:', error);
    }

    return null;
  } catch (error) {
    console.error('图标提取详细错误:', error);
    return null;
  }
}
