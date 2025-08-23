// Configuration file for Page Price Analyzer Extension
// Update these values with your actual Supabase credentials

const CONFIG = {
    // Supabase Configuration
    SUPABASE: {
        URL: 'https://xlnqqbbyivqlymmgchlw.supabase.co',  // ✅ Your Supabase URL
        ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbnFxYmJ5aXZxbHltbWdjaGx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMDkwOTgsImV4cCI6MjA2NTU4NTA5OH0.kyU2uNqVc6bualjIOUIW9syuAYdS4llPRVcrwBDOOIM'  // ✅ Your anon key
    },
    
    // Extension Settings
    EXTENSION: {
        NAME: 'Page Price Analyzer',
        VERSION: '1.0.0',
        SOURCE: 'Page Price Analyzer Extension'
    },
    
    // Database Table
    TABLE: {
        JOB_SUBMISSIONS: 'job_submissions'
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    // For browser environment
    window.CONFIG = CONFIG;
}
