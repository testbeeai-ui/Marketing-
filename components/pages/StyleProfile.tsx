import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThumbsUp, ThumbsDown, Image, FileText, Sparkles, Linkedin, Twitter, Instagram, Facebook } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { authService } from "@/lib/auth";

const API_BASE = '/api';

// Helper to get auth headers
async function getAuthHeaders(): Promise<Record<string, string>> {
    const token = await authService.getSessionToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

interface StyleProfileData {
    stories: Record<string, { liked: any[]; disliked: any[] }>;
    captions: Record<string, { liked: any[]; disliked: any[]; totalLikes: number; totalDislikes: number }>;
    images: Record<string, { liked: any[]; disliked: any[]; totalLikes: number; totalDislikes: number }>;
    summary: { totalInteractions: number; platforms: string[] };
}

const platformIcons: Record<string, any> = {
    linkedin: Linkedin,
    twitter: Twitter,
    instagram: Instagram,
    facebook: Facebook,
};

const platformColors: Record<string, string> = {
    linkedin: "bg-blue-600",
    twitter: "bg-sky-500",
    instagram: "bg-gradient-to-r from-purple-500 to-pink-500",
    facebook: "bg-blue-700",
};

export default function StyleProfile() {
    const { data: profile, isLoading, error } = useQuery<StyleProfileData>({
        queryKey: ['style-profile'],
        queryFn: async () => {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_BASE}/style-profile`, { headers });
            if (!response.ok) throw new Error('Failed to fetch style profile');
            return response.json();
        },
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background">
                <Navbar />
                <div className="pt-20 flex items-center justify-center h-[80vh]">
                    <div className="animate-pulse text-muted-foreground">Loading your style profile...</div>
                </div>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="min-h-screen bg-background">
                <Navbar />
                <div className="pt-20 flex items-center justify-center h-[80vh]">
                    <div className="text-destructive">Failed to load style profile. Please try again.</div>
                </div>
            </div>
        );
    }

    const totalLikes = Object.values(profile.images).reduce((sum, i) => sum + (i.totalLikes || 0), 0) +
        Object.values(profile.captions).reduce((sum, c) => sum + (c.totalLikes || 0), 0);
    const totalDislikes = Object.values(profile.images).reduce((sum, i) => sum + (i.totalDislikes || 0), 0) +
        Object.values(profile.captions).reduce((sum, c) => sum + (c.totalDislikes || 0), 0);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen bg-background"
        >
            <Navbar />

            <div className="pt-20 px-6 pb-12 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                        <Sparkles className="w-8 h-8 text-violet-500" />
                        My Style Profile
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        See how AI learns from your preferences to create better content
                    </p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card className="bg-card/50 border-border/50">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-full bg-green-500/10">
                                    <ThumbsUp className="w-6 h-6 text-green-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{totalLikes}</p>
                                    <p className="text-sm text-muted-foreground">Total Likes</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/50 border-border/50">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-full bg-red-500/10">
                                    <ThumbsDown className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{totalDislikes}</p>
                                    <p className="text-sm text-muted-foreground">Total Dislikes</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/50 border-border/50">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-full bg-violet-500/10">
                                    <Sparkles className="w-6 h-6 text-violet-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{profile.summary.totalInteractions}</p>
                                    <p className="text-sm text-muted-foreground">Total Interactions</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Platform Tabs */}
                <Tabs defaultValue="images" className="space-y-6">
                    <TabsList className="bg-muted/50">
                        <TabsTrigger value="images" className="flex items-center gap-2">
                            <Image className="w-4 h-4" />
                            Images
                        </TabsTrigger>
                        <TabsTrigger value="captions" className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Captions
                        </TabsTrigger>
                        <TabsTrigger value="stories" className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            Stories
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="images" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {Object.entries(profile.images).map(([platform, data]) => {
                                const Icon = platformIcons[platform];
                                const total = (data.totalLikes || 0) + (data.totalDislikes || 0);
                                const likePercent = total > 0 ? ((data.totalLikes || 0) / total) * 100 : 0;

                                return (
                                    <Card key={platform} className="bg-card/50 border-border/50">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                {Icon && <Icon className="w-5 h-5" />}
                                                {platform.charAt(0).toUpperCase() + platform.slice(1)} Images
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <ThumbsUp className="w-4 h-4 text-green-500" />
                                                    <span>{data.totalLikes || 0}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <ThumbsDown className="w-4 h-4 text-red-500" />
                                                    <span>{data.totalDislikes || 0}</span>
                                                </div>
                                            </div>
                                            <Progress value={likePercent} className="h-2" />
                                            <p className="text-xs text-muted-foreground mt-2">
                                                {likePercent.toFixed(0)}% approval rate
                                            </p>

                                            {data.liked.length > 0 && (
                                                <div className="mt-4">
                                                    <p className="text-xs font-medium text-muted-foreground mb-2">Recent likes:</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {data.liked.slice(0, 3).map((item, i) => (
                                                            <Badge key={i} variant="secondary" className="text-xs">
                                                                {item.style || 'Liked style'}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </TabsContent>

                    <TabsContent value="captions" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {Object.entries(profile.captions).map(([platform, data]) => {
                                const Icon = platformIcons[platform];
                                const total = (data.totalLikes || 0) + (data.totalDislikes || 0);
                                const likePercent = total > 0 ? ((data.totalLikes || 0) / total) * 100 : 0;

                                return (
                                    <Card key={platform} className="bg-card/50 border-border/50">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                {Icon && <Icon className="w-5 h-5" />}
                                                {platform.charAt(0).toUpperCase() + platform.slice(1)} Captions
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <ThumbsUp className="w-4 h-4 text-green-500" />
                                                    <span>{data.totalLikes || 0}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <ThumbsDown className="w-4 h-4 text-red-500" />
                                                    <span>{data.totalDislikes || 0}</span>
                                                </div>
                                            </div>
                                            <Progress value={likePercent} className="h-2" />
                                            <p className="text-xs text-muted-foreground mt-2">
                                                {likePercent.toFixed(0)}% approval rate
                                            </p>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </TabsContent>

                    <TabsContent value="stories" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {Object.entries(profile.stories).map(([style, data]) => {
                                const total = data.liked.length + data.disliked.length;
                                const likePercent = total > 0 ? (data.liked.length / total) * 100 : 0;

                                return (
                                    <Card key={style} className="bg-card/50 border-border/50">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-lg capitalize">{style} Style</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <ThumbsUp className="w-4 h-4 text-green-500" />
                                                    <span>{data.liked.length}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <ThumbsDown className="w-4 h-4 text-red-500" />
                                                    <span>{data.disliked.length}</span>
                                                </div>
                                            </div>
                                            <Progress value={likePercent} className="h-2" />
                                            <p className="text-xs text-muted-foreground mt-2">
                                                {likePercent.toFixed(0)}% approval rate
                                            </p>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </motion.div>
    );
}

