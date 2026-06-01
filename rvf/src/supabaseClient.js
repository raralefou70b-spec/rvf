import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ifwqzmbblwxptfnnnedv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bga0ADfoDbeTUeM41F_gxg_F8pg9tXc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
