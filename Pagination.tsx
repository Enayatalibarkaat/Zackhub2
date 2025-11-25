import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  
  // Logic to generate smart page numbers (e.g., 1 ... 4 5 6 ... 10)
  const getPageNumbers = () => {
    const delta = 1; // How many pages to show around current page
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  };

  const handlePrev = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  if (totalPages <= 1) return null;

  return (
    <nav className="flex flex-wrap justify-center items-center gap-2 mt-8 mb-8 select-none">
      {/* Previous Button */}
      <button
        onClick={handlePrev}
        disabled={currentPage === 1}
        className="px-3 py-2 font-medium text-sm bg-light-card dark:bg-brand-card text-light-text dark:text-brand-text rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm"
        aria-label="Previous page"
      >
        Prev
      </button>

      {/* Page Numbers */}
      {getPageNumbers().map((page, index) => {
        if (page === '...') {
          return (
            <span key={`dots-${index}`} className="px-2 text-light-text-secondary dark:text-brand-text-secondary">
              ...
            </span>
          );
        }

        return (
          <button
            key={page}
            onClick={() => onPageChange(Number(page))}
            className={`
              w-9 h-9 flex items-center justify-center font-medium text-sm rounded-md transition-all shadow-sm
              ${
                currentPage === page
                  ? 'bg-brand-primary text-white scale-110'
                  : 'bg-light-card dark:bg-brand-card text-light-text dark:text-brand-text hover:bg-gray-200 dark:hover:bg-gray-700'
              }
            `}
            aria-current={currentPage === page ? 'page' : undefined}
          >
            {page}
          </button>
        );
      })}

      {/* Next Button */}
      <button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="px-3 py-2 font-medium text-sm bg-light-card dark:bg-brand-card text-light-text dark:text-brand-text rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm"
        aria-label="Next page"
      >
        Next
      </button>
    </nav>
  );
};

export default Pagination;
