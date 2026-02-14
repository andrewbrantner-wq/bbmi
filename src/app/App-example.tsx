import React from 'react';
import { AuthProvider } from './AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import { signOut } from 'firebase/auth';
import { auth } from './firebase-config';

// Your existing NCAA Today's Picks component
import NCAAPicksPage from './NCAAPicksPage'; // Update with your actual import

function App() {
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthProvider>
      <div>
        {/* Your existing header/navigation */}
        
        {/* Wrap your NCAA picks page with ProtectedRoute */}
        <ProtectedRoute>
          <div style={{ position: 'relative' }}>
            {/* Optional: Add sign out button */}
            <button
              onClick={handleSignOut}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                padding: '8px 16px',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Sign Out
            </button>
            
            {/* Your protected content */}
            <NCAAPicksPage />
          </div>
        </ProtectedRoute>
      </div>
    </AuthProvider>
  );
}

export default App;
