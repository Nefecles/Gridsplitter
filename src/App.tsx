import React, { useState, useCallback, useRef, useMemo } from 'react';
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
  Plus,
  LayoutGrid,
  ArrowRightLeft,
  GripVertical
} from 'lucide-react';
import JSZip from 'jszip';
import { Reorder } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  const [activeTab, setActiveTab] = useState<'split' | 'merge'>('split');
  
  // Split State
  const [splitImages, setSplitImages] = useState<SplitImage[]>([]);
  const [splitRows, setSplitRows] = useState(3);
  const [splitCols, setSplitCols] = useState(3);
  const [splitGap, setSplitGap] = useState(0);
  const [isProcessingSplit, setIsProcessingSplit] = useState(false);
  
  // Merge State
  const [mergeImages, setMergeImages] = useState<SplitImage[]>([]);
  const [mergeRows, setMergeRows] = useState(3);
  const [mergeCols, setMergeCols] = useState(3);
  const [mergeGap, setMergeGap] = useState(0);
  const [isProcessingMerge, setIsProcessingMerge] = useState(false);
  const [mergedPreview, setMergedPreview] = useState<string | null>(null);
  const [mergeAspectRatio, setMergeAspectRatio] = useState<number>(1); // Default to 1:1

  // Calculate the optimal grid dimensions to fit the preview area (approx 1000x600)
  const gridStyle = useMemo(() => {
    const gap = mergeGap;
    const r = mergeAspectRatio;
    const cols = mergeCols;
    const rows = mergeRows;
    const padding = gap > 0 ? 16 : 0; // 8px padding on each side

    // Available space in the preview container (with some safety margin)
    const availableW = 1000 - 40; 
    const availableH = 600 - 40;

    // Find the largest cell size that fits both constraints
    // Constraint 1: cols * w + (cols-1) * gap + padding <= availableW
    const maxWByWidth = (availableW - padding - (cols - 1) * gap) / cols;
    // Constraint 2: rows * (w/r) + (rows-1) * gap + padding <= availableH
    const maxWByHeight = ((availableH - padding - (rows - 1) * gap) / rows) * r;

    const cellW = Math.max(1, Math.min(maxWByWidth, maxWByHeight));
    const cellH = cellW / r;

    const totalW = cols * cellW + (cols - 1) * gap + padding;
    const totalH = rows * cellH + (rows - 1) * gap + padding;

    return {
      width: `${totalW}px`,
      height: `${totalH}px`,
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gridTemplateRows: `repeat(${rows}, 1fr)`,
      gap: `${gap}px`,
      padding: gap > 0 ? '8px' : '0px',
      backgroundColor: gap > 0 ? 'white' : 'transparent'
    };
  }, [mergeCols, mergeRows, mergeAspectRatio, mergeGap]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mergeFileInputRef = useRef<HTMLInputElement>(null);

  const addImages = (files: FileList | null, mode: 'split' | 'merge') => {
    if (!files || files.length === 0) return;

    const newImages: SplitImage[] = Array.from(files).map((file: File) => ({
      id: Math.random().toString(36).substring(7),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending'
    }));

    if (mode === 'split') {
      setSplitImages(prev => [...prev, ...newImages]);
      toast.success(`成功添加 ${newImages.length} 张图片`);
    } else {
      const maxCount = mergeRows * mergeCols;
      const currentCount = mergeImages.length;
      const remaining = maxCount - currentCount;

      if (remaining <= 0) {
        toast.error(`已达到最大宫格数 (${maxCount})，无法继续添加`);
        newImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
        return;
      }

      const allowedImages = newImages.slice(0, remaining);
      if (allowedImages.length < newImages.length) {
        toast.warning(`仅添加了前 ${allowedImages.length} 张图片，超出的部分已忽略`);
        newImages.slice(remaining).forEach(img => URL.revokeObjectURL(img.previewUrl));
      }

      // For merge, sort by filename by default
      const sorted = [...allowedImages].sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true, sensitivity: 'base' }));
      setMergeImages(prev => [...prev, ...sorted]);
      
      // Update aspect ratio based on the first image
      if (allowedImages.length > 0 && currentCount === 0) {
        const img = new Image();
        img.onload = () => {
          setMergeAspectRatio(img.width / img.height);
        };
        img.src = allowedImages[0].previewUrl;
      }
      toast.success(`成功添加 ${allowedImages.length} 张图片`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, mode: 'split' | 'merge') => {
    addImages(e.target.files, mode);
    // Reset input value to allow uploading the same file again
    e.target.value = '';
  };

  const removeImage = (id: string, mode: 'split' | 'merge') => {
    if (mode === 'split') {
      setSplitImages(prev => {
        const filtered = prev.filter(img => img.id !== id);
        const removed = prev.find(img => img.id === id);
        if (removed) URL.revokeObjectURL(removed.previewUrl);
        return filtered;
      });
    } else {
      setMergeImages(prev => {
        const filtered = prev.filter(img => img.id !== id);
        const removed = prev.find(img => img.id === id);
        if (removed) URL.revokeObjectURL(removed.previewUrl);
        return filtered;
      });
    }
  };

  const clearAll = (mode: 'split' | 'merge') => {
    if (mode === 'split') {
      splitImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
      setSplitImages([]);
    } else {
      mergeImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
      setMergeImages([]);
      setMergedPreview(null);
    }
    toast.info('已清空所有图片');
  };

  const splitImageAction = async (image: SplitImage, r: number, c: number, g: number): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject('Canvas context not available');
          return;
        }

        const pieceWidth = (img.width - (c - 1) * g) / c;
        const pieceHeight = (img.height - (r - 1) * g) / r;
        const results: string[] = [];

        for (let i = 0; i < r; i++) {
          for (let j = 0; j < c; j++) {
            canvas.width = pieceWidth;
            canvas.height = pieceHeight;
            ctx.clearRect(0, 0, pieceWidth, pieceHeight);
            const sx = j * (pieceWidth + g);
            const sy = i * (pieceHeight + g);
            ctx.drawImage(img, sx, sy, pieceWidth, pieceHeight, 0, 0, pieceWidth, pieceHeight);
            results.push(canvas.toDataURL('image/png'));
          }
        }
        resolve(results);
      };
      img.onerror = () => reject('Failed to load image');
      img.src = image.previewUrl;
    });
  };

  const processSplit = async () => {
    if (splitImages.length === 0) return;
    setIsProcessingSplit(true);
    for (let i = 0; i < splitImages.length; i++) {
      const img = splitImages[i];
      try {
        setSplitImages(prev => prev.map(item => item.id === img.id ? { ...item, status: 'processing' } : item));
        const results = await splitImageAction(img, splitRows, splitCols, splitGap);
        setSplitImages(prev => prev.map(item => item.id === img.id ? { ...item, status: 'completed', splitResult: results } : item));
      } catch (error) {
        console.error(error);
        setSplitImages(prev => prev.map(item => item.id === img.id ? { ...item, status: 'error' } : item));
        toast.error(`处理图片 ${img.file.name} 失败`);
      }
    }
    setIsProcessingSplit(false);
    toast.success('所有图片处理完成');
  };

  const mergeImagesAction = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (mergeImages.length === 0) {
        reject('No images to merge');
        return;
      }

      const loadedImages: HTMLImageElement[] = [];
      let loadedCount = 0;

      const onAllLoaded = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject('Canvas context not available');
          return;
        }

        // Use the dimensions of the first image as the base for all cells
        const cellWidth = loadedImages[0].width;
        const cellHeight = loadedImages[0].height;

        canvas.width = mergeCols * cellWidth + (mergeCols - 1) * mergeGap;
        canvas.height = mergeRows * cellHeight + (mergeRows - 1) * mergeGap;

        // Fill background with white (or transparent)
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        loadedImages.forEach((img, index) => {
          if (index >= mergeRows * mergeCols) return;
          const r = Math.floor(index / mergeCols);
          const c = index % mergeCols;
          const dx = c * (cellWidth + mergeGap);
          const dy = r * (cellHeight + mergeGap);
          
          // Draw image scaled to fit cell
          ctx.drawImage(img, dx, dy, cellWidth, cellHeight);
        });

        resolve(canvas.toDataURL('image/png'));
      };

      mergeImages.forEach((imgData, index) => {
        const img = new Image();
        img.onload = () => {
          loadedImages[index] = img;
          loadedCount++;
          if (loadedCount === mergeImages.length) {
            onAllLoaded();
          }
        };
        img.onerror = () => reject(`Failed to load image ${imgData.file.name}`);
        img.src = imgData.previewUrl;
      });
    });
  };

  const processMerge = async () => {
    if (mergeImages.length === 0) return;
    setIsProcessingMerge(true);
    try {
      const result = await mergeImagesAction();
      setMergedPreview(result);
      toast.success('拼图生成成功');
    } catch (error) {
      console.error(error);
      toast.error('生成拼图失败');
    } finally {
      setIsProcessingMerge(false);
    }
  };

  const downloadSplitZip = async () => {
    const processedImages = splitImages.filter(img => img.status === 'completed' && img.splitResult);
    if (processedImages.length === 0) {
      toast.error('没有已处理完成的图片可供下载');
      return;
    }
    const zip = new JSZip();
    processedImages.forEach((img) => {
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
    link.click();
    URL.revokeObjectURL(url);
    toast.success('压缩包已开始下载');
  };

  const downloadMerged = () => {
    if (!mergedPreview) return;
    const link = document.createElement('a');
    link.href = mergedPreview;
    link.download = `GridMerged_${new Date().getTime()}.png`;
    link.click();
    toast.success('拼图已开始下载');
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
            快速将九宫格图片拆分为单张，或将多张图片拼合成精美宫格图。
          </motion.p>
        </header>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="grid w-full max-w-md grid-cols-2 h-12 p-1 bg-secondary/50 rounded-2xl">
              <TabsTrigger value="split" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" />
                宫格拆分
              </TabsTrigger>
              <TabsTrigger value="merge" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2">
                <Grid3X3 className="w-4 h-4" />
                图片拼合
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="split" className="mt-0 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* Controls Panel */}
              <div className="lg:col-span-4 space-y-6 flex flex-col">
                <Card className="border-none shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-primary/5 border-b border-primary/10">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <LayoutGrid className="w-5 h-5" />
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
                            value={splitRows} 
                            onChange={(e) => setSplitRows(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                            className="w-16 h-8 text-center font-mono"
                            min={1}
                            max={10}
                          />
                          <Badge variant="secondary" className="font-mono">{splitRows}</Badge>
                        </div>
                      </div>
                      <div className="relative w-full h-6 flex items-center px-1">
                        <input 
                          type="range"
                          min={1}
                          max={10}
                          step={1}
                          value={splitRows}
                          onChange={(e) => setSplitRows(parseInt(e.target.value))}
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
                            value={splitCols} 
                            onChange={(e) => setSplitCols(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                            className="w-16 h-8 text-center font-mono"
                            min={1}
                            max={10}
                          />
                          <Badge variant="secondary" className="font-mono">{splitCols}</Badge>
                        </div>
                      </div>
                      <div className="relative w-full h-6 flex items-center px-1">
                        <input 
                          type="range"
                          min={1}
                          max={10}
                          step={1}
                          value={splitCols}
                          onChange={(e) => setSplitCols(parseInt(e.target.value))}
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
                            value={splitGap} 
                            onChange={(e) => setSplitGap(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-16 h-8 text-center font-mono"
                            min={0}
                          />
                          <Badge variant="secondary" className="font-mono">{splitGap}px</Badge>
                        </div>
                      </div>
                      <div className="relative w-full h-6 flex items-center px-1">
                        <input 
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={splitGap}
                          onChange={(e) => setSplitGap(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary/80 transition-all"
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">如原图块之间有白边或间隔，请调整此项以剔除。</p>
                    </div>

                    <div className="pt-4 space-y-3">
                      <Button 
                        className="w-full h-12 text-lg font-medium shadow-md hover:shadow-lg transition-all"
                        disabled={splitImages.length === 0 || isProcessingSplit}
                        onClick={processSplit}
                      >
                        {isProcessingSplit ? (
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
                        disabled={splitImages.length === 0 || isProcessingSplit || !splitImages.some(img => img.status === 'completed')}
                        onClick={downloadSplitZip}
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
                    "relative group border-2 border-dashed rounded-3xl p-8 transition-all duration-300 flex flex-col items-center justify-center space-y-4 cursor-pointer h-[200px]",
                    splitImages.length === 0 ? "bg-white border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5" : "bg-white border-primary/20"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    addImages(e.dataTransfer.files, 'split');
                  }}
                >
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={(e) => handleFileUpload(e, 'split')}
                  />
                  <div className="p-4 bg-primary/10 rounded-full text-primary group-hover:scale-110 transition-transform">
                    <Upload className="w-10 h-10" />
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-semibold">点击或拖拽图片上传</p>
                    <p className="text-muted-foreground mt-1">支持多张图片批量处理</p>
                  </div>
                </div>

                {splitImages.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-2">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        待处理队列
                        <Badge variant="outline">{splitImages.length}</Badge>
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => clearAll('split')} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4 mr-2" />
                        清空全部
                      </Button>
                    </div>

                    <ScrollArea className="h-[640px] rounded-3xl border bg-white shadow-sm p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <AnimatePresence mode="popLayout">
                          {splitImages.map((img) => (
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
                                  onClick={() => removeImage(img.id, 'split')}
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
          </TabsContent>

          <TabsContent value="merge" className="mt-0 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* Controls Panel */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                <Card className="border-none shadow-sm bg-white overflow-hidden flex-1">
                  <CardHeader className="bg-primary/5 border-b border-primary/10">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Grid3X3 className="w-5 h-5" />
                      拼图设置
                    </CardTitle>
                    <CardDescription>设置宫格行列与间距</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-8">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label className="text-sm font-medium">行数 (Rows)</Label>
                        <div className="flex items-center gap-3">
                          <Input 
                            type="number" 
                            value={mergeRows} 
                            onChange={(e) => setMergeRows(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                            className="w-16 h-8 text-center font-mono"
                            min={1}
                            max={10}
                          />
                          <Badge variant="secondary" className="font-mono">{mergeRows}</Badge>
                        </div>
                      </div>
                      <div className="relative w-full h-6 flex items-center px-1">
                        <input 
                          type="range"
                          min={1}
                          max={10}
                          step={1}
                          value={mergeRows}
                          onChange={(e) => setMergeRows(parseInt(e.target.value))}
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
                            value={mergeCols} 
                            onChange={(e) => setMergeCols(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                            className="w-16 h-8 text-center font-mono"
                            min={1}
                            max={10}
                          />
                          <Badge variant="secondary" className="font-mono">{mergeCols}</Badge>
                        </div>
                      </div>
                      <div className="relative w-full h-6 flex items-center px-1">
                        <input 
                          type="range"
                          min={1}
                          max={10}
                          step={1}
                          value={mergeCols}
                          onChange={(e) => setMergeCols(parseInt(e.target.value))}
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
                            value={mergeGap} 
                            onChange={(e) => setMergeGap(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-16 h-8 text-center font-mono"
                            min={0}
                          />
                          <Badge variant="secondary" className="font-mono">{mergeGap}px</Badge>
                        </div>
                      </div>
                      <div className="relative w-full h-6 flex items-center px-1">
                        <input 
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={mergeGap}
                          onChange={(e) => setMergeGap(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary/80 transition-all"
                        />
                      </div>
                    </div>

                    <div className="pt-4 space-y-3">
                      <Button 
                        className="w-full h-12 text-lg font-medium shadow-md hover:shadow-lg transition-all"
                        disabled={mergeImages.length === 0 || isProcessingMerge}
                        onClick={processMerge}
                      >
                        {isProcessingMerge ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            正在生成...
                          </>
                        ) : (
                          <>
                            <LayoutGrid className="mr-2 h-5 w-5" />
                            生成宫格拼图
                          </>
                        )}
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className="w-full h-12 text-lg font-medium"
                        disabled={!mergedPreview}
                        onClick={downloadMerged}
                      >
                        <Download className="mr-2 h-5 w-5" />
                        下载合并图
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-secondary/50 border-b">
                    <CardTitle className="text-sm font-medium">拼图说明</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 text-sm text-muted-foreground space-y-2">
                    <p>1. 批量上传图片，默认按文件名排序</p>
                    <p>2. <b>直接在下方网格中拖动图片</b>调整排列顺序</p>
                    <p>3. 设置行列数，网格会实时同步显示效果</p>
                    <p>4. 调整“间距”可实现无缝拼接 (0px)</p>
                    <p>5. 满意后点击“下载合并图”即可获取大图</p>
                  </CardContent>
                </Card>
              </div>

              {/* Main Content Area */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                <div 
                  className={cn(
                    "relative group border-2 border-dashed rounded-3xl p-8 transition-all duration-300 flex flex-col items-center justify-center space-y-4 cursor-pointer h-[200px]",
                    mergeImages.length === 0 ? "bg-white border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5" : "bg-white border-primary/20"
                  )}
                  onClick={() => mergeFileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    addImages(e.dataTransfer.files, 'merge');
                  }}
                >
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    className="hidden" 
                    ref={mergeFileInputRef}
                    onChange={(e) => handleFileUpload(e, 'merge')}
                  />
                  <div className="p-4 bg-primary/10 rounded-full text-primary group-hover:scale-110 transition-transform">
                    <Upload className="w-10 h-10" />
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-semibold">点击或拖拽图片上传</p>
                    <p className="text-muted-foreground mt-1">支持批量上传后手动排序</p>
                  </div>
                </div>

                <div className="space-y-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-center px-2">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      素材排序
                      <Badge variant="outline">{mergeImages.length}</Badge>
                      <span className="text-xs font-normal text-muted-foreground ml-2 flex items-center gap-1">
                        <ArrowRightLeft className="w-3 h-3" />
                        拖动调整顺序（默认按文件名排序）
                      </span>
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => clearAll('merge')} className="text-destructive hover:text-destructive hover:bg-destructive/10" disabled={mergeImages.length === 0}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      清空全部
                    </Button>
                  </div>

                  <div className="w-full h-[600px] rounded-3xl border bg-secondary/10 shadow-inner p-4 flex items-center justify-center overflow-hidden">
                    <Reorder.Group 
                      values={mergeImages} 
                      onReorder={setMergeImages}
                      className={cn(
                        "grid box-border overflow-hidden",
                        mergeGap > 0 ? "shadow-2xl rounded-xl" : ""
                      )}
                      style={gridStyle}
                    >
                      {/* Render actual images */}
                      {mergeImages.map((img, index) => (
                        <Reorder.Item
                          key={img.id}
                          value={img}
                          drag={true}
                          dragListener={true}
                          whileDrag={{ 
                            scale: 1.05, 
                            zIndex: 50,
                            boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"
                          }}
                          transition={{ type: "spring", stiffness: 500, damping: 35 }}
                          className={cn(
                            "relative cursor-grab active:cursor-grabbing overflow-hidden flex items-center justify-center w-full h-full bg-white select-none",
                            mergeGap > 0 ? "border border-transparent hover:border-primary/50 shadow-sm" : "border-r border-b border-secondary/20"
                          )}
                          style={{ 
                            borderRadius: mergeGap > 0 ? '8px' : '0px',
                          }}
                        >
                          <div className="relative w-full h-full group flex items-center justify-center">
                            <img 
                              src={img.previewUrl} 
                              alt={img.file.name} 
                              className="w-full h-full object-contain block"
                            />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <GripVertical className={cn(
                                  "text-white opacity-0 group-hover:opacity-100 transition-opacity",
                                  Math.max(mergeRows, mergeCols) > 6 ? "w-3 h-3" : "w-6 h-6"
                                )} />
                              </div>
                              <div className={cn(
                                "absolute top-0.5 left-0.5 bg-black/50 text-white rounded-sm backdrop-blur-sm flex items-center justify-center",
                                Math.max(mergeRows, mergeCols) > 6 ? "text-[8px] px-0.5" : "text-[10px] px-1.5 py-0.5"
                              )}>
                                {index + 1}
                              </div>
                              <button
                                className="absolute top-0.5 right-0.5 rounded-full bg-white/80 hover:bg-destructive hover:text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                style={{ 
                                  width: Math.max(mergeRows, mergeCols) > 6 ? '14px' : '20px',
                                  height: Math.max(mergeRows, mergeCols) > 6 ? '14px' : '20px'
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeImage(img.id, 'merge');
                                }}
                              >
                                <X className={Math.max(mergeRows, mergeCols) > 6 ? "w-2 h-2" : "w-3 h-3"} />
                              </button>
                            </div>
                          </Reorder.Item>
                        ))}
                        
                          {/* Render empty placeholders to complete the grid */}
                          {Array.from({ length: Math.max(0, mergeRows * mergeCols - mergeImages.length) }).map((_, i) => (
                            <div 
                              key={`empty-${i}`}
                              className={cn(
                                "flex items-center justify-center w-full h-full",
                                mergeGap > 0 ? "bg-secondary/10 border border-dashed border-muted-foreground/20" : "bg-secondary/5"
                              )}
                              style={{ 
                                borderRadius: mergeGap > 0 ? '8px' : '0px',
                              }}
                            >
                            <div className="text-muted-foreground/20 flex flex-col items-center">
                              <ImageIcon className={Math.max(mergeRows, mergeCols) > 6 ? "w-3 h-3" : "w-6 h-6"} />
                              <span className={Math.max(mergeRows, mergeCols) > 6 ? "text-[8px]" : "text-[10px]"}>
                                {mergeImages.length + i + 1}
                              </span>
                            </div>
                          </div>
                        ))}
                      </Reorder.Group>
                    </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <footer className="pt-12 pb-8 border-t text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} GridSplitter - 极简拼图切图工具</p>
        </footer>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
