
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Manually load .env since we're running primarily via ts-node/tsx which might skip next.js env loading
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.log('⚠️ .env file not found at:', envPath);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use service role key to ensure we have permission to upload
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testBucket() {
    console.log('--- 🧪 Supabase Bucket Test ---');

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing credentials in .env');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // 1. Check if "images" bucket exists
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();

        if (listError) {
            console.error('❌ Connection failed:', listError.message);
            return;
        }

        const imagesBucket = buckets.find(b => b.name === 'images');

        if (!imagesBucket) {
            console.error('❌ Bucket "images" NOT found.');
            console.log('   Current buckets:', buckets.map(b => b.name).join(', '));
            return;
        }

        console.log('✅ Bucket "images" exists!');
        console.log(`   Public: ${imagesBucket.public}`);

        // 2. Upload a test file
        const fileName = `test_connection_${Date.now()}.txt`;
        const fileContent = 'Supabase storage connection verified successfully!';

        console.log(`\n📤 Uploading test file: ${fileName}...`);

        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('images')
            .upload(`debug/${fileName}`, Buffer.from(fileContent), {
                contentType: 'text/plain',
                upsert: true
            });

        if (uploadError) {
            console.error('❌ Upload failed:', uploadError.message);
            return;
        }

        console.log('✅ Upload successful!');

        // 3. Get Public URL
        const { data: { publicUrl } } = supabase
            .storage
            .from('images')
            .getPublicUrl(uploadData.path);

        console.log('🔗 Public URL:', publicUrl);
        console.log('\n🎉 SYSTEM READY: Image storage is fully operational.');

    } catch (error: any) {
        console.error('❌ Unexpected error:', error.message);
    }
}

testBucket();
