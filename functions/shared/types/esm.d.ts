// Type declarations for ESM imports
declare module 'https://esm.sh/@huggingface/inference@2.3.2' {
  export class HfInference {
    constructor(apiKey?: string);
    featureExtraction(options: { model: string; inputs: string }): Promise<number[]>;
  }
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export interface SupabaseClient {
    from(table: string): any;
    rpc(functionName: string, params?: any): any;
    auth: any;
  }
  
  export function createClient(url: string, key: string, options?: any): SupabaseClient;
}

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

// Generic fallback for any Deno std imports
declare module 'https://deno.land/std@*' {
  const _: any;
  export = _;
}

declare module 'https://esm.sh/@xenova/transformers@2.17.1' {
  const _: any;
  export = _;
}
