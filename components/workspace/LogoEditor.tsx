/**
 * LogoEditor Component
 * 
 * Professional-grade interactive editor for placing and sizing MULTIPLE logos.
 * Features:
 * - Multi-logo support
 * - Drag & Drop with Alignment Guides (Smart Snapping)
 * - Keyboard Shortcuts (Arrows to nudge, Delete, Undo/Redo)
 * - Undo/Redo History System
 * - Precision Controls
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, RotateCcw, ZoomIn, ZoomOut, Move, Trash2, Plus, Undo2, Redo2, AlignCenterHorizontal, AlignCenterVertical, Keyboard, Eraser } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface LogoEditorProps {
    imageUrl: string;
    logoBase64: string;
    logoMimeType: string;
    onApply: (logos: LogoInstance[]) => void;
    onCancel: () => void;
    platform?: string;
}

export interface LogoInstance {
    id: string;
    base64: string;
    mimeType: string;
    x: number; // percentage from left (0-100)
    y: number; // percentage from top (0-100)
    scale: number; // scale factor
    removeBackground?: boolean; // toggle for smart removal
    previewBase64?: string; // Client-side processed image for preview
}

export interface LogoPosition {
    x: number;
    y: number;
    scale: number;
}

export function LogoEditor({
    imageUrl,
    logoBase64,
    logoMimeType,
    onApply,
    onCancel,
    platform
}: LogoEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial State
    const initialLogo: LogoInstance = {
        id: `logo-${Date.now()}`,
        base64: logoBase64,
        mimeType: logoMimeType,
        x: 85,
        y: 85,
        scale: 0.15,
        removeBackground: false,
        previewBase64: logoBase64
    };

    // State
    const [logos, setLogos] = useState<LogoInstance[]>([initialLogo]);
    const [selectedLogoId, setSelectedLogoId] = useState<string | null>(initialLogo.id);

    // History State for Undo/Redo
    const [history, setHistory] = useState<LogoInstance[][]>([]);
    const [future, setFuture] = useState<LogoInstance[][]>([]);

    // Interaction State
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

    // Alignment Guides State
    const [guides, setGuides] = useState({ x: false, y: false });

    // Constants
    const SNAP_THRESHOLD = 2; // % distance to snap

    // Get current selected logo
    const selectedLogo = logos.find(l => l.id === selectedLogoId);

    // Helper: Add current state to history before changing
    const addToHistory = useCallback(() => {
        setHistory(prev => [...prev.slice(-19), logos]); // Keep last 20 states
        setFuture([]); // Clear redo history on new change
    }, [logos]);

    // Undo action
    const handleUndo = useCallback(() => {
        if (history.length === 0) return;
        const previous = history[history.length - 1];
        const newHistory = history.slice(0, -1);

        setFuture(prev => [logos, ...prev]);
        setLogos(previous);
        setHistory(newHistory);
        // Restore selection if possible, otherwise deselect
        if (selectedLogoId && !previous.find(l => l.id === selectedLogoId)) {
            setSelectedLogoId(null);
        }
    }, [history, logos, selectedLogoId]);

    // Redo action
    const handleRedo = useCallback(() => {
        if (future.length === 0) return;
        const next = future[0];
        const newFuture = future.slice(1);

        setHistory(prev => [...prev, logos]);
        setLogos(next);
        setFuture(newFuture);
    }, [future, logos]);

    // Calculate logo size based on container and scale
    const getLogoSize = useCallback((scale: number) => {
        if (!imageDimensions.width) return 0;
        return Math.round(imageDimensions.width * scale);
    }, [imageDimensions.width]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Undo/Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) handleRedo();
                else handleUndo();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                handleRedo();
                return;
            }

            if (!selectedLogoId) return;

            // Delete
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                handleDeleteLogo();
                return;
            }

            // Nudge Position (Arrows)
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                addToHistory(); // Save state before nudge

                const step = e.shiftKey ? 2.0 : 0.5; // Shift for larger jumps

                setLogos(prev => prev.map(l => {
                    if (l.id !== selectedLogoId) return l;
                    let { x, y } = l;

                    switch (e.key) {
                        case 'ArrowLeft': x = Math.max(0, x - step); break;
                        case 'ArrowRight': x = Math.min(100, x + step); break;
                        case 'ArrowUp': y = Math.max(0, y - step); break;
                        case 'ArrowDown': y = Math.min(100, y + step); break;
                    }
                    return { ...l, x, y };
                }));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedLogoId, handleUndo, handleRedo, addToHistory]);

    // Handle drag start
    const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, logoId: string) => {
        e.preventDefault();
        e.stopPropagation();

        // Save history before starting a drag operation
        // Note: Ideally we save history on drag END, but for simplicity...
        // Actually, let's save history on drag END to avoid spamming history with intermediate steps

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const logoElement = document.getElementById(`logo-${logoId}`);
        if (logoElement) {
            const logoRect = logoElement.getBoundingClientRect();
            setDragOffset({
                x: clientX - logoRect.left,
                y: clientY - logoRect.top
            });
        }

        setSelectedLogoId(logoId);
        setIsDragging(true);
        addToHistory(); // We'll save state at start of drag, so if they move it, we can undo back to here
    }, [addToHistory]);

    // Handle drag move
    const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isDragging || !containerRef.current || !imageRef.current || !selectedLogoId) return;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const imageRect = imageRef.current.getBoundingClientRect();
        const logo = logos.find(l => l.id === selectedLogoId);
        if (!logo) return;

        const logoSize = getLogoSize(logo.scale);

        // Calculate raw position as percentage of image dimensions
        let newX = ((clientX - imageRect.left - dragOffset.x + logoSize / 2) / imageRect.width) * 100;
        let newY = ((clientY - imageRect.top - dragOffset.y + logoSize / 2) / imageRect.height) * 100;

        // Snapping Logic
        let snappedX = newX;
        let snappedY = newY;
        const currentGuides = { x: false, y: false };

        // Snap to center X (50%)
        if (Math.abs(newX - 50) < SNAP_THRESHOLD) {
            snappedX = 50;
            currentGuides.x = true;
        }

        // Snap to center Y (50%)
        if (Math.abs(newY - 50) < SNAP_THRESHOLD) {
            snappedY = 50;
            currentGuides.y = true;
        }

        setGuides(currentGuides);

        // Clamp to bounds (allow slightly outside like 0-100)
        snappedX = Math.max(0, Math.min(100, snappedX));
        snappedY = Math.max(0, Math.min(100, snappedY));

        setLogos(prev => prev.map(l =>
            l.id === selectedLogoId
                ? { ...l, x: snappedX, y: snappedY }
                : l
        ));
    }, [isDragging, dragOffset, selectedLogoId, logos, getLogoSize]);

    // Handle drag end
    const handleDragEnd = useCallback(() => {
        setIsDragging(false);
        setGuides({ x: false, y: false }); // Clear guides
    }, []);

    // Global drag listeners
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleDragMove);
            window.addEventListener('mouseup', handleDragEnd);
            window.addEventListener('touchmove', handleDragMove);
            window.addEventListener('touchend', handleDragEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleDragMove);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, [isDragging, handleDragMove, handleDragEnd]);

    // Handle image load
    const handleImageLoad = () => {
        if (imageRef.current) {
            setImageDimensions({
                width: imageRef.current.offsetWidth,
                height: imageRef.current.offsetHeight
            });
            setImageLoaded(true);
        }
    };

    // Resize listener
    useEffect(() => {
        const handleResize = () => {
            if (imageRef.current) {
                setImageDimensions({
                    width: imageRef.current.offsetWidth,
                    height: imageRef.current.offsetHeight
                });
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Scale Logic
    const handleScaleChange = (newScale: number) => {
        if (!selectedLogoId) return;
        addToHistory();
        setLogos(prev => prev.map(l =>
            l.id === selectedLogoId ? { ...l, scale: newScale } : l
        ));
    };

    // Position Logic (Manual)
    const handlePositionChange = (x: number, y: number) => {
        if (!selectedLogoId) return;
        addToHistory();
        setLogos(prev => prev.map(l =>
            l.id === selectedLogoId ? { ...l, x, y } : l
        ));
    };

    // Delete Logic
    const handleDeleteLogo = () => {
        if (!selectedLogoId) return;
        addToHistory();
        setLogos(prev => prev.filter(l => l.id !== selectedLogoId));
        setSelectedLogoId(null);
        toast.info("Logo removed");
    };

    // Toggle Background Removal
    const handleToggleBackground = () => {
        if (!selectedLogoId) return;
        addToHistory();
        setLogos(prev => prev.map(l =>
            l.id === selectedLogoId ? { ...l, removeBackground: !l.removeBackground } : l
        ));
        toast.info(selectedLogo?.removeBackground ? "Smart background removal disabled" : "Smart background removal enabled");
    };

    /**
     * Smart Background Removal Logic (Client-Side)
     * Matches the backend logic: samples corners and removes similar pixels
     */
    const processLogoTransparency = useCallback(async (logo: LogoInstance) => {
        if (!logo.removeBackground) {
            // Revert to original if disabled
            if (logo.previewBase64 !== logo.base64) {
                setLogos(prev => prev.map(l => l.id === logo.id ? { ...l, previewBase64: l.base64 } : l));
            }
            return;
        }

        // Avoid re-processing if we already have a processed version (and it's not the same as original)
        // Note: This simple check assumes if preview != base64, it's already processed. 
        // We might want more robust dirty checking but this is fine for toggle.
        if (logo.previewBase64 && logo.previewBase64 !== logo.base64) return;

        try {
            const img = new Image();
            img.src = `data:${logo.mimeType};base64,${logo.base64}`;
            await new Promise((resolve) => { img.onload = resolve; });

            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const { width, height } = canvas;

            // Sample corners for background color
            const sampleSize = Math.max(3, Math.min(width, height) * 0.05);
            const corners = [
                { x: 0, y: 0 },
                { x: width - sampleSize, y: 0 },
                { x: 0, y: height - sampleSize },
                { x: width - sampleSize, y: height - sampleSize }
            ];

            // Average color from corners
            let r = 0, g = 0, b = 0, count = 0;
            for (const corner of corners) {
                for (let dy = 0; dy < sampleSize; dy++) {
                    for (let dx = 0; dx < sampleSize; dx++) {
                        const px = (Math.floor(corner.y + dy) * width + Math.floor(corner.x + dx)) * 4;
                        if (px < data.length) {
                            r += data[px];
                            g += data[px + 1];
                            b += data[px + 2];
                            count++;
                        }
                    }
                }
            }
            const bgR = r / count;
            const bgG = g / count;
            const bgB = b / count;

            const isWhite = bgR > 240 && bgG > 240 && bgB > 240;
            const threshold = isWhite ? 60 : 50; // Higher tolerance for white

            // Apply transparency
            for (let i = 0; i < data.length; i += 4) {
                const pr = data[i];
                const pg = data[i + 1];
                const pb = data[i + 2];

                // Euclidean distance check
                const dist = Math.sqrt(
                    Math.pow(pr - bgR, 2) +
                    Math.pow(pg - bgG, 2) +
                    Math.pow(pb - bgB, 2)
                );

                if (dist < threshold) {
                    data[i + 3] = 0; // Transparent
                } else if (dist < threshold + 20) {
                    // Soft edge (feather)
                    const alpha = ((dist - threshold) / 20) * 255;
                    data[i + 3] = Math.min(data[i + 3], alpha);
                }
            }

            ctx.putImageData(imageData, 0, 0);
            const processedBase64 = canvas.toDataURL(logo.mimeType).split(',')[1];

            setLogos(prev => prev.map(l => l.id === logo.id ? { ...l, previewBase64: processedBase64 } : l));
        } catch (e) {
            console.error("Client-side background removal failed", e);
        }
    }, []);

    // Effect to trigger processing when flags change
    useEffect(() => {
        logos.forEach(logo => {
            if (logo.removeBackground && logo.previewBase64 === logo.base64) {
                processLogoTransparency(logo);
            } else if (!logo.removeBackground && logo.previewBase64 !== logo.base64) {
                // Revert
                setLogos(prev => prev.map(l => l.id === logo.id ? { ...l, previewBase64: l.base64 } : l));
            }
        });
    }, [logos, processLogoTransparency]);

    // Add Logo
    const handleAddLogo = (base64: string, mimeType: string) => {
        addToHistory();
        const newLogo: LogoInstance = {
            id: `logo-${Date.now()}`,
            base64,
            mimeType,
            x: 50,
            y: 50,
            scale: 0.15,
            removeBackground: false,
            previewBase64: base64
        };
        setLogos(prev => [...prev, newLogo]);
        setSelectedLogoId(newLogo.id);
        toast.success("New logo added");
    };

    // Reset Logic
    const handleReset = () => {
        addToHistory();
        setLogos([initialLogo]);
        setSelectedLogoId(initialLogo.id);
        toast.info("Reset to default");
    };

    // File Upload Handler
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (logos.length >= 5) {
            toast.error("Maximum 5 logos allowed");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            const mimeType = file.type || 'image/png';
            handleAddLogo(base64, mimeType);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    return (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4">
            <div className="relative w-full max-w-5xl bg-background rounded-xl overflow-hidden shadow-2xl flex flex-col h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-secondary/30 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Move className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Logo Studio</h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span className="flex items-center gap-1"><Keyboard className="w-3 h-3" /> Arrows to nudge</span>
                                <span>•</span>
                                <span>Shift+Arrow for jump</span>
                                <span>•</span>
                                <span>Delete to remove</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center mr-4 bg-muted rounded-lg p-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={handleUndo}
                                disabled={history.length === 0}
                                title="Undo (Ctrl+Z)"
                            >
                                <Undo2 className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={handleRedo}
                                disabled={future.length === 0}
                                title="Redo (Ctrl+Y)"
                            >
                                <Redo2 className="w-4 h-4" />
                            </Button>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onCancel}
                            className="hover:bg-destructive/10 hover:text-destructive"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Editor Surface */}
                <div
                    className="flex-1 relative bg-neutral-900/50 flex items-center justify-center overflow-hidden checkerboard-bg"
                    onClick={() => setSelectedLogoId(null)}
                >
                    <div
                        ref={containerRef}
                        className="relative shadow-2xl"
                    >
                        {/* Background Image */}
                        <img
                            ref={imageRef}
                            src={imageUrl}
                            alt="Edit canvas"
                            onLoad={handleImageLoad}
                            className="max-h-[60vh] object-contain select-none pointer-events-none"
                            draggable={false}
                        />

                        {/* Alignment Guides */}
                        {guides.x && (
                            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-cyan-500/80 shadow-[0_0_8px_rgba(6,182,212,0.8)] z-50 pointer-events-none" />
                        )}
                        {guides.y && (
                            <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-cyan-500/80 shadow-[0_0_8px_rgba(6,182,212,0.8)] z-50 pointer-events-none" />
                        )}

                        {/* Logos Layer */}
                        {imageLoaded && logos.map((logo) => {
                            const logoSize = getLogoSize(logo.scale);
                            const isSelected = logo.id === selectedLogoId;

                            return (
                                <div
                                    key={logo.id}
                                    id={`logo-${logo.id}`}
                                    className={cn(
                                        "absolute cursor-move select-none touch-none",
                                        isSelected ? "z-40" : "z-30 hover:z-30",
                                    )}
                                    style={{
                                        width: logoSize,
                                        height: 'auto',
                                        left: `calc(${logo.x}% - ${logoSize / 2}px)`,
                                        top: `calc(${logo.y}% - ${logoSize / 2}px)`,
                                    }}
                                    onMouseDown={(e) => handleDragStart(e, logo.id)}
                                    onTouchStart={(e) => handleDragStart(e, logo.id)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedLogoId(logo.id);
                                    }}
                                >
                                    <div className={cn(
                                        "relative w-full h-full transition-all duration-200",
                                        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-transparent",
                                        !isSelected && "hover:ring-1 hover:ring-primary/50"
                                    )}>
                                        <img
                                            src={`data:${logo.mimeType};base64,${logo.previewBase64 || logo.base64}`}
                                            alt="logo"
                                            className="w-full h-auto pointer-events-none block"
                                            draggable={false}
                                        />

                                        {/* Selection Handles (Visual only) */}
                                        {isSelected && (
                                            <>
                                                <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-primary rounded-full shadow-sm" />
                                                <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-primary rounded-full shadow-sm" />
                                                <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-primary rounded-full shadow-sm" />
                                                <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-primary rounded-full shadow-sm" />
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Toolbar */}
                <div className="p-6 border-t bg-background shrink-0 space-y-4">

                    <div className="flex items-center justify-between">
                        {/* Logo Selector / Add */}
                        <div className="flex items-center gap-3">
                            <div className="flex -space-x-2 overflow-hidden py-1 pl-1">
                                {logos.map((logo, idx) => (
                                    <button
                                        key={logo.id}
                                        onClick={() => setSelectedLogoId(logo.id)}
                                        className={cn(
                                            "relative w-10 h-10 rounded-full border-2 bg-white transition-transform hover:scale-110 hover:z-10 focus:outline-none focus:ring-2 focus:ring-primary focus:z-20",
                                            logo.id === selectedLogoId
                                                ? "border-primary z-20 scale-105"
                                                : "border-muted z-0"
                                        )}
                                        title={`Select Logo ${idx + 1}`}
                                    >
                                        <div className="w-full h-full p-1.5 flex items-center justify-center">
                                            <img
                                                src={`data:${logo.mimeType};base64,${logo.base64}`}
                                                className="max-w-full max-h-full object-contain"
                                                alt={`L${idx}`}
                                            />
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="h-8 w-px bg-border mx-2" />

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                className="h-9 gap-2"
                                disabled={logos.length >= 5}
                            >
                                <Plus className="w-4 h-4" />
                                Add Logo
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </div>

                        {/* Controls for Selected Logo */}
                        {selectedLogo ? (
                            <div className="flex items-center gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {/* Size Slider */}
                                <div className="flex items-center gap-3 bg-secondary/30 px-3 py-1.5 rounded-full">
                                    <ZoomOut className="w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="range"
                                        min="0.05"
                                        max="0.4"
                                        step="0.01"
                                        value={selectedLogo.scale}
                                        onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                                        className="w-32 h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                    <ZoomIn className="w-4 h-4 text-muted-foreground" />
                                </div>

                                <div className="h-8 w-px bg-border" />

                                {/* Quick Align */}
                                <div className="flex gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9"
                                        onClick={() => handlePositionChange(50, selectedLogo.y)}
                                        title="Center Horizontally"
                                    >
                                        <AlignCenterHorizontal className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9"
                                        onClick={() => handlePositionChange(selectedLogo.x, 50)}
                                        title="Center Vertically"
                                    >
                                        <AlignCenterVertical className="w-4 h-4" />
                                    </Button>
                                </div>

                                <div className="h-8 w-px bg-border" />

                                {/* Background Toggle */}
                                <Button
                                    variant={selectedLogo.removeBackground ? "secondary" : "ghost"}
                                    size="icon"
                                    className="h-9 w-9"
                                    onClick={handleToggleBackground}
                                    title="Remove Background (Smart)"
                                >
                                    <Eraser className="w-4 h-4" />
                                </Button>

                                <div className="h-8 w-px bg-border" />

                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDeleteLogo}
                                    className="h-9 gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Remove
                                </Button>
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground italic">
                                Select a logo to edit
                            </div>
                        )}
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="flex items-center justify-between pt-4">
                        <Button
                            variant="ghost"
                            onClick={handleReset}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Reset All
                        </Button>

                        <div className="flex gap-3">
                            <Button variant="secondary" size="lg" onClick={onCancel}>
                                Cancel
                            </Button>
                            <Button size="lg" onClick={() => onApply(logos)} className="px-8 font-semibold shadow-lg shadow-primary/20">
                                <Check className="w-4 h-4 mr-2" />
                                Apply {logos.length > 1 ? `${logos.length} Logos` : 'Logo'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
