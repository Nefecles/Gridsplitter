import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Download, 
  Trash2, 
  Grid3X3, 
  Image as ImageIcon, 
  X, 
  FileArchive, 
  CheckCircle2,
  Loader2,
  Plus
} from 'lucide-react';
import JSZip from 'jszip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SplitImage {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  splitResult?: string[]; // Array of data URLs
}

export default function App() {
  const [images, setImages] = useState<SplitImage[]>([]);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [gap, setGap] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: SplitImage[] = Array.from(files).map((file: File) => ({
      id: Math.random().toString(36).substring(7),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending'
    }));

    setImages(prev => [...prev, ...newImages]);
    toast.success(`成功添加 ${newImages.length} 张图片`);
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      const removed = prev.find(img => img.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return filtered;
    });
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
    toast.info('已清空所有图片');
  };

  const splitImage = async (image: SplitImage, r: number, c: number, g: number): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject('Canvas context not available');
          return;
        }

        // Calculate piece dimensions excluding gaps
        // totalWidth = c * pieceWidth + (c - 1) * g
        const pieceWidth = (img.width - (c - 1) * g) / c;
        const pieceHeight = (img.height - (r - 1) * g) / r;
        const results: string[] = [];

        for (let i = 0; i < r; i++) {
          for (let j = 0; j < c; j++) {
            canvas.width = pieceWidth;
            canvas.height = pieceHeight;
            ctx.clearRect(0, 0, pieceWidth, pieceHeight);
            
            // Source coordinates skip the gaps
            const sx = j * (pieceWidth + g);
            const sy = i * (pieceHeight + g);

            ctx.drawImage(
              img,
              sx, sy, pieceWidth, pieceHeight,
              0, 0, pieceWidth, pieceHeight
            );
            results.push(canvas.toDataURL('image/png'));
          }
        }
        resolve(results);
      };
      img.onerror = () => reject('Failed to load image');
      img.src = image.previewUrl;
    });
  };

  const processAll = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    
    const updatedImages = [...images];
    
    for (let i = 0; i < updatedImages.length; i++) {
      const img = updatedImages[i];
      try {
        setImages(prev => prev.map(item => item.id === img.id ? { ...item, status: 'processing' } : item));
        const results = await splitImage(img, rows, cols, gap);
        setImages(prev => prev.map(item => item.id === img.id ? { ...item, status: 'completed', splitResult: results } : item));
      } catch (error) {
        console.error(error);
        setImages(prev => prev.map(item => item.id === img.id ? { ...item, status: 'error' } : item));
        toast.error(`处理图片 ${img.file.name} 失败`);
      }
    }
    
    setIsProcessing(false);
    toast.success('所有图片处理完成');
  };

  const downloadZip = async () => {
    const processedImages = images.filter(img => img.status === 'completed' && img.splitResult);
    if (processedImages.length === 0) {
      toast.error('没有已处理完成的图片可供下载');
      return;
    }

    const zip = new JSZip();
    
    processedImages.forEach((img, imgIdx) => {
      const folderName = img.file.name.split('.')[0];
      const folder = zip.folder(folderName);
      
      img.splitResult?.forEach((dataUrl, partIdx) => {
        const base64Data = dataUrl.split(',')[1];
        folder?.file(`part_${partIdx + 1}.png`, base64Data, { base64: true });
      });
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GridSplitter_Export_${new Date().getTime()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('压缩包已开始下载');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="text-center space-y-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center p-3 bg-primary text-primary-foreground rounded-2xl shadow-lg mb-4"
          >
            <Grid3X3 className="w-8 h-8" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-4xl md:text-5xl font-bold tracking-tight"
          >
            GridSplitter
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-muted-foreground text-lg max-w-2xl mx-auto"
          >
            快速将九宫格图片或任何拼图拆分为单张图片。支持批量处理与一键打包下载。
          </motion.p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls Panel */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="bg-primary/5 border-b border-primary/10">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Grid3X3 className="w-5 h-5" />
                  切割设置
                </CardTitle>
                <CardDescription>自定义行数和列数</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-medium">行数 (Rows)</Label>
                    <div className="flex items-center gap-3">
                      <Input 
                        type="number" 
                        value={rows} 
                        onChange={(e) => setRows(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-16 h-8 text-center font-mono"
                        min={1}
                        max={10}
                      />
                      <Badge variant="secondary" className="font-mono">{rows}</Badge>
                    </div>
                  </div>
                  <div className="relative w-full h-6 flex items-center px-1">
                    <input 
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={rows}
                      onChange={(e) => setRows(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary/80 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-medium">列数 (Columns)</Label>
                    <div className="flex items-center gap-3">
                      <Input 
                        type="number" 
                        value={cols} 
                        onChange={(e) => setCols(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-16 h-8 text-center font-mono"
                        min={1}
                        max={10}
                      />
                      <Badge variant="secondary" className="font-mono">{cols}</Badge>
                    </div>
                  </div>
                  <div className="relative w-full h-6 flex items-center px-1">
                    <input 
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={cols}
                      onChange={(e) => setCols(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary/80 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-medium">间距 (Gap Size)</Label>
                    <div className="flex items-center gap-3">
                      <Input 
                        type="number" 
                        value={gap} 
                        onChange={(e) => setGap(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-16 h-8 text-center font-mono"
                        min={0}
                      />
                      <Badge variant="secondary" className="font-mono">{gap}px</Badge>
                    </div>
                  </div>
                  <div className="relative w-full h-6 flex items-center px-1">
                    <input 
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={gap}
                      onChange={(e) => setGap(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary/80 transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">如果原图块之间有白边或间隔，请调整此项以剔除间隔。</p>
                </div>

                <div className="pt-4 space-y-3">
                  <Button 
                    className="w-full h-12 text-lg font-medium shadow-md hover:shadow-lg transition-all"
                    disabled={images.length === 0 || isProcessing}
                    onClick={processAll}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        正在处理...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-5 w-5" />
                        开始批量处理
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full h-12 text-lg font-medium"
                    disabled={images.length === 0 || isProcessing || !images.some(img => img.status === 'completed')}
                    onClick={downloadZip}
                  >
                    <FileArchive className="mr-2 h-5 w-5" />
                    打包下载 ZIP
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="bg-secondary/50 border-b">
                <CardTitle className="text-sm font-medium">使用提示</CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-sm text-muted-foreground space-y-2">
                <p>1. 点击上传或拖拽图片到右侧区域</p>
                <p>2. 调整左侧滑块设置切割网格（如 3x3）</p>
                <p>3. <b>若原图块间有白边/缝隙</b>，请调节“间距”以剔除</p>
                <p>4. 点击“开始批量处理”生成切图</p>
                <p>5. 点击“打包下载”获取所有切图的压缩包</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-6">
            <div 
              className={cn(
                "relative group border-2 border-dashed rounded-3xl p-12 transition-all duration-300 flex flex-col items-center justify-center space-y-4 cursor-pointer",
                images.length === 0 ? "bg-white border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5" : "bg-white border-primary/20"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const files = e.dataTransfer.files;
                if (files) {
                  const newImages: SplitImage[] = Array.from(files).map((file: File) => ({
                    id: Math.random().toString(36).substring(7),
                    file,
                    previewUrl: URL.createObjectURL(file),
                    status: 'pending'
                  }));
                  setImages(prev => [...prev, ...newImages]);
                  toast.success(`成功添加 ${newImages.length} 张图片`);
                }
              }}
            >
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <div className="p-4 bg-primary/10 rounded-full text-primary group-hover:scale-110 transition-transform">
                <Upload className="w-10 h-10" />
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold">点击或拖拽图片上传</p>
                <p className="text-muted-foreground mt-1">支持多张图片批量处理</p>
              </div>
            </div>

            {images.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    待处理队列
                    <Badge variant="outline">{images.length}</Badge>
                  </h3>
                  <Button variant="ghost" size="sm" onClick={clearAll} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4 mr-2" />
                    清空全部
                  </Button>
                </div>

                <ScrollArea className="h-[500px] rounded-3xl border bg-white shadow-sm p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AnimatePresence mode="popLayout">
                      {images.map((img) => (
                        <motion.div
                          key={img.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="group relative bg-secondary/30 rounded-2xl p-3 border border-transparent hover:border-primary/20 transition-all"
                        >
                          <div className="flex gap-4">
                            <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                              <img 
                                src={img.previewUrl} 
                                alt={img.file.name} 
                                className="w-full h-full object-cover"
                              />
                              {img.status === 'processing' && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                                </div>
                              )}
                              {img.status === 'completed' && (
                                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                  <CheckCircle2 className="w-8 h-8 text-primary fill-white" />
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0 py-1 flex flex-col justify-between">
                              <div>
                                <p className="font-medium truncate text-sm">{img.file.name}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {(img.file.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {img.status === 'completed' ? (
                                  <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-[10px] h-5">已完成</Badge>
                                ) : img.status === 'processing' ? (
                                  <Badge variant="secondary" className="text-[10px] h-5">处理中</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] h-5">等待中</Badge>
                                )}
                              </div>
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full bg-white/80 hover:bg-destructive hover:text-white"
                              onClick={() => removeImage(img.id)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>

                          {img.status === 'completed' && img.splitResult && (
                            <div className="mt-3 pt-3 border-t border-dashed flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">
                                已生成 {img.splitResult.length} 张切图
                              </p>
                              <Button 
                                variant="link" 
                                size="sm" 
                                className="h-auto p-0 text-xs"
                                onClick={() => {
                                  // Individual download if needed
                                  const zip = new JSZip();
                                  img.splitResult?.forEach((dataUrl, idx) => {
                                    const base64Data = dataUrl.split(',')[1];
                                    zip.file(`part_${idx + 1}.png`, base64Data, { base64: true });
                                  });
                                  zip.generateAsync({ type: 'blob' }).then(content => {
                                    const url = URL.createObjectURL(content);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = `${img.file.name.split('.')[0]}_split.zip`;
                                    link.click();
                                    URL.revokeObjectURL(url);
                                  });
                                }}
                              >
                                下载此图切片
                              </Button>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="pt-12 pb-8 border-t text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} GridSplitter - 极简拼图切图工具</p>
        </footer>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
