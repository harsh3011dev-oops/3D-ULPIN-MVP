import React from 'react';
import Header from '../components/Header/Header';
import UploadForm from '../components/UploadForm/UploadForm';

export default function UploadPage() {
  return (
    <div className="page-layout">
      <Header />
      <main style={{ maxWidth: '1000px', margin: '100px auto 40px', padding: '0 20px' }}>
        <UploadForm />
      </main>
    </div>
  );
}
