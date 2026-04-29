import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);

async function checkFirstRow() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Erro: Variáveis de ambiente VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configuradas.');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('cff')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Erro ao buscar dados:', error.message);
      return;
    }

    if (data && data.length > 0) {
      console.log('--- PRIMEIRA LINHA DA TABELA CFF ---');
      console.log(JSON.stringify(data[0], null, 2));
      console.log('------------------------------------');
    } else {
      console.log('A tabela "cff" está vazia ou não foi encontrada.');
    }
  } catch (err) {
    console.error('Erro inesperado:', err);
  }
}

checkFirstRow();
