import { motion } from 'framer-motion';
import { Plus, Search, CheckCircle2, Trash2, Brain, AlertCircle } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Modal } from '../components/ui/Common';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api, MissingPerson } from '../services/api';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

// ── Zod schema ─────────────────────────────────────────────────────────────
const PersonSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  age: z.string().min(1, 'Age is required').transform((v) => parseInt(v, 10)).pipe(
    z.number().min(1, 'Age must be at least 1').max(120, 'Invalid age')
  ),
  gender: z.enum(['Male', 'Female', 'Other']),
  description: z.string().optional(),
  photo: z.any().refine(
    (v) => {
      if (!v) return false;
      const file = v instanceof FileList ? v[0] : v;
      return file instanceof File && file.size > 0;
    },
    { message: 'Please select a photo' }
  ),
});

type PersonFormData = {
  name: string;
  age: string;
  gender: 'Male' | 'Female' | 'Other';
  description?: string;
  photo: FileList | File | null;
};

// ── Person Card ─────────────────────────────────────────────────────────────
function PersonCard({
  person,
  onMarkFound,
  onDelete,
  canMarkFound,
  canDelete,
}: {
  person: MissingPerson;
  onMarkFound: (id: number) => void;
  onDelete: (id: number) => void;
  canMarkFound: boolean;
  canDelete: boolean;
}) {
  const photoUrl = api.getPhotoUrl(person.photo_path);
  const initials = person.name.charAt(0).toUpperCase();

  return (
    <motion.div
      whileHover={{ translateY: -4 }}
      className="bg-slate-900/50 border border-slate-700/50 rounded-xl overflow-hidden hover:border-brand-accent/50 transition-all group"
    >
      {/* Photo */}
      <div className="relative h-48 bg-slate-800 overflow-hidden">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={person.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              (e.currentTarget.nextElementSibling as HTMLElement | null)?.removeAttribute('hidden');
            }}
          />
        ) : null}
        <div
          className={cn(
            'w-full h-full flex items-center justify-center bg-slate-700/50',
            photoUrl ? 'hidden' : 'flex'
          )}
        >
          <span className="text-5xl font-bold text-slate-400">{initials}</span>
        </div>

        {/* Status badge */}
        <div className="absolute top-3 right-3">
          <span className={cn(
            'px-2 py-1 rounded-full text-xs font-bold border',
            person.status === 'FOUND'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              : person.status === 'POSSIBLE_MATCH'
              ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400'
              : 'bg-red-500/20 border-red-500/40 text-red-400'
          )}>
            {person.status}
          </span>
        </div>

        {/* Face enrollment badge */}
        <div className="absolute top-3 left-3">
          {person.face_enrolled ? (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-blue-500/20 border border-blue-500/40 text-blue-300">
              <Brain className="w-3 h-3" />
              AI Enrolled
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-slate-700/60 border border-slate-600/40 text-slate-400">
              <AlertCircle className="w-3 h-3" />
              No Face
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-white font-bold text-lg mb-1">{person.name}</h3>
        <p className="text-slate-400 text-sm mb-1">
          {person.age} yrs • {person.gender}
        </p>
        {person.last_seen_location && (
          <p className="text-slate-500 text-xs mb-2 truncate">📍 {person.last_seen_location}</p>
        )}
        {person.description && (
          <p className="text-slate-500 text-xs mb-2 truncate">{person.description}</p>
        )}
        <p className="text-xs text-slate-600 mb-4">
          Reported: {new Date(person.reported_date).toLocaleDateString()}
        </p>

        {/* Face enrollment info */}
        {person.face_enrolled && (
          <p className="text-xs text-blue-400 mb-3 flex items-center gap-1">
            <Brain className="w-3 h-3" />
            FaceNet 512-dim embedding stored — active in matching pipeline
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {canMarkFound || canDelete ? (
            <>
              {canMarkFound && (person.status === 'ACTIVE' || person.status === 'POSSIBLE_MATCH') ? (
                <button
                  onClick={() => onMarkFound(person.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Found
                </button>
              ) : canMarkFound ? (
                <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs rounded-lg bg-slate-800 text-slate-500 border border-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Found
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs rounded-lg bg-slate-800 text-slate-500 border border-slate-700">
                  Read only
                </div>
              )}
              {canDelete && (
                <button
                  onClick={() => onDelete(person.id)}
                  className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                  title="Remove from database"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs rounded-lg bg-slate-800 text-slate-500 border border-slate-700">
              View only
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl overflow-hidden animate-pulse">
      <div className="h-48 bg-slate-800" />
      <div className="p-4 space-y-2">
        <div className="h-5 bg-slate-700 rounded w-3/4" />
        <div className="h-4 bg-slate-700 rounded w-1/2" />
        <div className="h-4 bg-slate-700 rounded w-1/3" />
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function MissingPersons() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const canAddPerson = user?.role === 'ADMIN' || user?.role === 'OPERATOR' || user?.role === 'USER';
  const [persons, setPersons] = useState<MissingPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ACTIVE' | 'FOUND' | 'POSSIBLE_MATCH'>('all');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PersonFormData>({
    resolver: zodResolver(PersonSchema) as any,
    defaultValues: { gender: 'Male' },
  });

  const fetchPersons = useCallback(async () => {
    try {
      const data = await api.getMissingPersons();
      setPersons(data.persons);
    } catch (err: any) {
      toast.error('Could not load persons from database');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPersons(); }, [fetchPersons]);

  useEffect(() => {
    // Refresh list periodically so FOUND status/count updates automatically.
    const interval = setInterval(() => {
      fetchPersons();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchPersons]);

  const onSubmit = async (data: PersonFormData) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('age', String(data.age));
    formData.append('gender', data.gender);
    if (data.description) formData.append('description', data.description);

    const file = data.photo instanceof FileList ? data.photo[0] : data.photo as File;
    if (file) formData.append('photo', file);

    try {
      const res = await api.registerMissingPerson(formData);
      setPersons(prev => [res.person, ...prev]);

      if (res.faceEnrolled) {
        toast.success('✅ Profile created & face enrolled in AI matching pipeline!');
      } else if (res.faceError) {
        toast.warning(`Profile created — face enrollment failed: ${res.faceError}`);
      } else {
        toast.info('Profile created (upload a photo for face matching)');
      }

      setIsAddModalOpen(false);
      reset();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create profile');
    }
  };

  const handleMarkFound = async (id: number) => {
    try {
      const res = await api.updatePersonStatus(id, 'FOUND');
      setPersons(prev => prev.map(p => p.id === id ? res.person : p));
      toast.success('Person marked as found!');
    } catch (err: any) {
      toast.error(err.message || 'Could not update status');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deletePerson(id);
      setPersons(prev => prev.filter(p => p.id !== id));
      toast.success('Person removed from database');
    } catch (err: any) {
      toast.error(err.message || 'Could not remove person');
    }
  };

  const filteredPersons = persons.filter(person => {
    const matchesSearch = person.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || person.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const enrolledCount = persons.filter(p => p.face_enrolled).length;
  const activeCount = persons.filter(p => p.status === 'ACTIVE').length;
  const foundCount = persons.filter(p => p.status === 'FOUND').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Missing Persons Database</h1>
        <p className="text-slate-400">
          Manage missing person profiles and face enrollment for AI detection
          {!loading && <span className="ml-2 text-brand-accent">({persons.length} registered)</span>}
        </p>
        {!isAdmin && (
          <p className="text-xs text-slate-500 mt-2">
            Limited mode: you can add records, but only admins can delete.
          </p>
        )}
      </div>

      {/* Stats strip */}
      {!loading && persons.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{activeCount}</p>
            <p className="text-xs text-slate-400 mt-1">Active Cases</p>
          </div>
          <div className="bg-slate-900/50 border border-blue-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{enrolledCount}</p>
            <p className="text-xs text-slate-400 mt-1">AI Face Enrolled</p>
          </div>
          <div className="bg-slate-900/50 border border-emerald-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{foundCount}</p>
            <p className="text-xs text-slate-400 mt-1">Found</p>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <Card className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand-accent"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as any)}
          className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-accent"
        >
          <option value="all">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="FOUND">Found</option>
          <option value="POSSIBLE_MATCH">Possible Match</option>
        </select>
        {canAddPerson && (
          <Button
            variant="primary"
            onClick={() => setIsAddModalOpen(true)}
            className="whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Person
          </Button>
        )}
      </Card>

      {/* Persons Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => <LoadingSkeleton key={i} />)}
        </div>
      ) : filteredPersons.length > 0 ? (
        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPersons.map((person, idx) => (
            <motion.div
              key={person.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <PersonCard
                person={person}
                onMarkFound={handleMarkFound}
                onDelete={handleDelete}
                canMarkFound={isAdmin}
                canDelete={isAdmin}
              />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <Card className="text-center py-12">
          <Search className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50" />
          <p className="text-slate-400">
            {persons.length === 0
              ? 'No persons registered yet. Add the first one!'
              : 'No persons match your search.'}
          </p>
        </Card>
      )}

      {/* Add Person Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); reset(); }}
        title="Add Missing Person"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Full Name *</label>
            <input
              {...register('name')}
              type="text"
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand-accent"
              placeholder="e.g. Rajesh Kumar"
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Age *</label>
              <input
                {...register('age')}
                type="number"
                min="1"
                max="120"
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand-accent"
                placeholder="Age"
              />
              {errors.age && <p className="text-red-400 text-xs mt-1">{errors.age.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Gender *</label>
              <select
                {...register('gender')}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-accent"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Reference Photo * <span className="text-blue-400 text-xs">(Required for AI face matching)</span>
            </label>
            <input
              {...register('photo')}
              type="file"
              accept="image/*"
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white file:text-white file:bg-slate-700 file:border-0 file:rounded file:cursor-pointer focus:outline-none focus:border-brand-accent"
            />
            {errors.photo && <p className="text-red-400 text-xs mt-1">{String(errors.photo.message)}</p>}
            <p className="text-xs text-slate-500 mt-1">
              Clear face photo — will generate a 512-dim FaceNet embedding for real-time matching in CCTV footage
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Description</label>
            <textarea
              {...register('description')}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand-accent"
              placeholder="Distinguishing features, last seen location, clothing, etc."
              rows={3}
            />
          </div>

          {isSubmitting && (
            <div className="flex items-center gap-2 text-blue-400 text-sm bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <Brain className="w-4 h-4 animate-pulse" />
              Running FaceNet enrollment — extracting 512-dim embedding from photo...
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => { setIsAddModalOpen(false); reset(); }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="flex-1"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enrolling Face...' : 'Create Profile'}
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
