// A implementação mora em supabase/functions/_shared para ser usada também pelo e-mail de
// confirmação (o runtime das Edge Functions só enxerga a pasta supabase/functions).
export * from '../../supabase/functions/_shared/agenda';
