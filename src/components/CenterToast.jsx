import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function CenterToast({ message, duration = 2000, onComplete }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onComplete?.(), 300); // Wait for fade to complete
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1, scale: 0.9 }}
      animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.9 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 flex items-center justify-center pointer-events-none"
    >
      <div className="bg-card border border-border rounded-lg shadow-lg px-6 py-4 max-w-sm text-center">
        <p className="text-sm font-medium text-foreground">{message}</p>
      </div>
    </motion.div>
  );
}