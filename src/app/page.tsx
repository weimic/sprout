import React from 'react';
import App from '../components/App';

export default function Page() {
  return (
  <React.StrictMode>
    <div className="flex flex-col h-screen">
      <div className="h-[20%]"></div>
      <div className="">
        <App />
      </div>
      
    </div>
    
  </React.StrictMode>
  );
}
