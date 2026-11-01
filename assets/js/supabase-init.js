// Inicialização do Supabase (SDK via CDN ESM, compatível com GitHub Pages - sem build step).
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Client que não guarda sessão: permite ao admin criar a conta de outra pessoa sem
 * trocar a própria sessão (limitação do SDK client-side sem Service Role Key).
 */
export function criarClienteIsolado() {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
}
