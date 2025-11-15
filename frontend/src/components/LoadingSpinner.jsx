export default function LoadingSpinner({ message = 'Processing...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-16 h-16 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin mb-4 shadow-lg" />
      <p className="text-slate-300 text-lg font-medium">{message}</p>
    </div>
  );
}
