import { useState } from 'react';

const INITIAL_STATE = {
  name: '',
  age: '',
  gender: '',
  description: '',
  last_seen_location: '',
  contact_info: '',
  photo: null
};

export default function PersonForm({ onSubmit }) {
  const [formValues, setFormValues] = useState(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value, files } = event.target;
    if (name === 'photo') {
      setFormValues((prev) => ({ ...prev, photo: files[0] }));
    } else {
      setFormValues((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const dbFormData = new FormData();
      dbFormData.append('name', formValues.name);
      dbFormData.append('age', formValues.age || 0);
      dbFormData.append('gender', formValues.gender);
      dbFormData.append('description', formValues.description);
      if (formValues.photo) {
        dbFormData.append('photo', formValues.photo);
      }

      await onSubmit?.(dbFormData);
      setFormValues(INITIAL_STATE);
      // Reset file input manually if needed
      if (document.getElementById('photo-upload')) {
        document.getElementById('photo-upload').value = '';
      }
    } catch (error) {
      console.error('Failed to submit person form', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="premium-card p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Register Missing Person</h2>
        <p className="text-slate-400">Capture key details to alert the monitoring team instantly.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-slate-300 text-sm font-medium" htmlFor="name">
            Full Name
          </label>
          <input
            id="name"
            name="name"
            required
            value={formValues.name}
            onChange={handleChange}
            className="input-premium w-full"
            placeholder="John Doe"
          />
        </div>
        <div className="space-y-2">
          <label className="text-slate-300 text-sm font-medium" htmlFor="age">
            Age
          </label>
          <input
            id="age"
            name="age"
            type="number"
            min="0"
            value={formValues.age}
            onChange={handleChange}
            className="input-premium w-full"
            placeholder="30"
          />
        </div>
        <div className="space-y-2">
          <label className="text-slate-300 text-sm font-medium" htmlFor="gender">
            Gender
          </label>
          <select
            id="gender"
            name="gender"
            value={formValues.gender}
            onChange={handleChange}
            className="input-premium w-full"
          >
            <option value="">Select</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-slate-300 text-sm font-medium" htmlFor="last_seen_location">
            Last Seen Location
          </label>
          <input
            id="last_seen_location"
            name="last_seen_location"
            value={formValues.last_seen_location}
            onChange={handleChange}
            className="input-premium w-full"
            placeholder="City square, Gate 3"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-slate-300 text-sm font-medium" htmlFor="photo-upload">
          Reference Photo (Required)
        </label>
        <input
          id="photo-upload"
          name="photo"
          type="file"
          accept="image/*"
          required
          onChange={handleChange}
          className="block w-full text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
        />
      </div>

      <div className="space-y-2">
        <label className="text-slate-300 text-sm font-medium" htmlFor="contact_info">
          Emergency Contact
        </label>
        <input
          id="contact_info"
          name="contact_info"
          value={formValues.contact_info}
          onChange={handleChange}
          className="input-premium w-full"
          placeholder="Contact number or email"
        />
      </div>

      <div className="space-y-2">
        <label className="text-slate-300 text-sm font-medium" htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formValues.description}
          onChange={handleChange}
          className="input-premium w-full min-h-[120px] resize-none"
          placeholder="Clothing, distinguishing marks, accessories..."
        />
      </div>

      <div className="flex justify-end">
        <button type="submit" className="btn-premium" disabled={submitting}>
          {submitting ? 'Saving...' : 'Add Person'}
        </button>
      </div>
    </form>
  );
}
