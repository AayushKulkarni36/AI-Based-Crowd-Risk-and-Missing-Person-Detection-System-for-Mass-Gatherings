export default function PersonTable({ persons = [], onStatusChange, onDelete }) {
  const getStatusBadge = (status) => {
    const badges = {
      ACTIVE: 'badge-warning',
      FOUND: 'badge-success',
      CLOSED: 'badge-info'
    };
    return badges[status] || 'badge-info';
  };

  return (
    <div className="premium-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-900/50 border-b border-slate-700">
            <tr>
              <th className="px-6 py-4 text-slate-300 font-semibold text-sm uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-slate-300 font-semibold text-sm uppercase tracking-wider">Age</th>
              <th className="px-6 py-4 text-slate-300 font-semibold text-sm uppercase tracking-wider">Gender</th>
              <th className="px-6 py-4 text-slate-300 font-semibold text-sm uppercase tracking-wider">Last Seen</th>
              <th className="px-6 py-4 text-slate-300 font-semibold text-sm uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-right text-slate-300 font-semibold text-sm uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {persons.map((person, index) => (
              <tr
                key={person.id}
                className="hover:bg-slate-800/50 transition-colors duration-200"
              >
                <td className="px-6 py-4">
                  <div className="font-semibold text-white">{person.name}</div>
                  <div className="text-sm text-slate-400 mt-1">{person.description || '—'}</div>
                </td>
                <td className="px-6 py-4 text-slate-300">{person.age || '—'}</td>
                <td className="px-6 py-4 text-slate-300">{person.gender || '—'}</td>
                <td className="px-6 py-4 text-slate-300">{person.last_seen_location || 'Unknown'}</td>
                <td className="px-6 py-4">
                  <span className={getStatusBadge(person.status)}>
                    {person.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end space-x-3">
                    <select
                      value={person.status}
                      onChange={(event) => onStatusChange?.(person.id, event.target.value)}
                      className="input-premium text-sm py-2"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="FOUND">Found</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => onDelete?.(person.id)}
                      className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {persons.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  No records available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
