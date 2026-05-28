import { useState, useEffect } from 'react';

export const LiveClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const formatted = time.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }) + ' • ' + time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <span style={{
      color: 'var(--color-text-muted)',
      fontSize: '13px',
      fontFamily: 'monospace'
    }}>
      {formatted}
    </span>
  );
};

export default LiveClock;
