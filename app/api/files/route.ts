import { NextRequest, NextResponse } from 'next/server';
import { fileProcessor } from '@/lib/services/fileProcessor';
import { vectorStore } from '@/lib/services/vectorStore';
import { knowledgeBase } from '@/lib/services/knowledgeBase';
import { blockStorage } from '@/lib/services/blockStorage';
import { getUserIdFromRequest } from '@/lib/auth-server';