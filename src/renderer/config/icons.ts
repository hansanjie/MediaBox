// 定义图标名称类型
type IconName = 'obs' | 'bandicam' | 'camtasia' | 'captura' | 'shanaencoder' | 'nvi-output';

// 定义图标映射
export const iconMap: Record<IconName, string> = {
  obs: '/icons/obs.png',
  bandicam: '/icons/bandicam.png',
  camtasia: '/icons/camtasia.png',
  captura: '/icons/captura.png',
  shanaencoder: '/icons/shanaencoder.png',
  'nvi-output': '/icons/nvi-output.png'
};

// 获取图标路径
export function getIconPath(name: string): string | null {
  const normalizedName = name.toLowerCase().replace(/\s+/g, '-') as IconName;
  return iconMap[normalizedName] || null;
}

// 检查图标是否存在
export function hasIcon(name: string): boolean {
  const normalizedName = name.toLowerCase().replace(/\s+/g, '-');
  return normalizedName in iconMap;
} 