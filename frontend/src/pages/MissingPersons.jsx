import { useEffect, useState } from 'react';
import PersonForm from '../components/PersonForm.jsx';
import PersonTable from '../components/PersonTable.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { api } from '../services/api.js';

export default function MissingPersons() {
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadPersons = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.getAllPersons();
      setPersons(data);
    } catch (err) {
      console.error('Failed to load persons:', err);
      setError('Unable to load missing persons.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPersons();
  }, []);

  const handleAddPerson = async (formData) => {
    try {
      await api.addPerson(formData);
      await loadPersons();
    } catch (err) {
      console.error('Failed to add person', err);
      setError('Unable to add person.');
      throw err;
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.updatePerson(id, { status });
      setPersons((prev) => prev.map((person) => (person.id === id ? { ...person, status } : person)));
    } catch (err) {
      console.error('Failed to update person status', err);
      setError('Unable to update status.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deletePerson(id);
      setPersons((prev) => prev.filter((person) => person.id !== id));
    } catch (err) {
      console.error('Failed to delete person', err);
      setError('Unable to delete record.');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Missing Persons Registry</h1>
        <p className="text-slate-400 text-lg">Coordinate search efforts and share updates across security teams.</p>
      </div>

      <PersonForm onSubmit={handleAddPerson} />

      {error && (
        <div className="premium-card p-4 bg-red-500/10 border-red-500/50 text-red-400">
          <p className="flex items-center space-x-2">
            <span>⚠️</span>
            <span>{error}</span>
          </p>
        </div>
      )}

      {loading ? (
        <div className="premium-card p-12">
          <LoadingSpinner message="Loading records..." />
        </div>
      ) : (
        <PersonTable persons={persons} onStatusChange={handleStatusChange} onDelete={handleDelete} />
      )}
    </div>
  );
}
