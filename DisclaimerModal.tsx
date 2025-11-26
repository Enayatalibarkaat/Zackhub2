import React from 'react';

interface DisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-light-card dark:bg-brand-card p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-2xl m-4 transform transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-brand-primary [text-shadow:0_0_8px_theme(colors.brand-primary)]">Legal Disclaimer</h2>
            <button 
                onClick={onClose} 
                className="p-2 rounded-full text-light-text-secondary dark:text-brand-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors" 
                aria-label="Close disclaimer"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
        <div className="text-sm sm:text-base text-light-text-secondary dark:text-brand-text-secondary space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <p>
                <strong>General Information:</strong> ZackHub is an online service provider that functions as a search engine, indexing and linking to content that is publicly available on the internet. This site does not host, store, or upload any media files on its servers. All contents are provided by non-affiliated third parties.
            </p>
            <p>
                <strong>Copyright Compliance:</strong> We respect the intellectual property rights of others and operate in compliance with the Digital Millennium Copyright Act (DMCA). We are not responsible for the content of external websites. If you believe that your copyrighted work has been infringed upon, we urge you to contact the hosting provider directly.
            </p>
            <p>
                <strong>DMCA Takedown Notice Procedure:</strong> For copyright holders, if you wish to request the removal of a link from our index, please send a proper notification to our DMCA Agent at: <span className="font-bold text-brand-primary">zzack2355@gmail.com</span>. Your request must include:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4">
                <li>Identification of the copyrighted work you claim has been infringed.</li>
                <li>The exact URL(s) on ZackHub where the allegedly infringing material is located.</li>
                <li>Your contact information (name, address, telephone number, and email address).</li>
                <li>A statement that you have a good faith belief that the use of the material is not authorized by the copyright owner, its agent, or the law.</li>
                <li>A statement, made under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorized to act on the owner's behalf.</li>
            </ul>
            <p>
                Upon receipt of a valid infringement notification, we will promptly investigate and remove the identified links from our search index.
            </p>
            <p>
                <strong>User Agreement:</strong> By using this site, you acknowledge that you have read and understood this disclaimer and agree to its terms. You agree not to hold ZackHub or its administrators liable for any content found through this service.
            </p>
        </div>
        <div className="mt-6 text-right">
            <button
              type="button"
              onClick={onClose}
              className="bg-brand-primary hover:bg-opacity-80 text-white font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline transition-colors"
            >
              I Understand & Agree
            </button>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerModal;
