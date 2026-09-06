// Ganti dengan Project URL dan anon key milikmu (dari Settings > API di Supabase)
const SUPABASE_URL = "https://ozxvqbfebqwyfltqatvf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96eHZxYmZlYnF3eWZsdHFhdHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMzI2NTUsImV4cCI6MjEwMzkwODY1NX0.JwRaEXsEp7CzqgbHd0vQ8s7YlxIOTn2c-SzVVtHZrYY";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);