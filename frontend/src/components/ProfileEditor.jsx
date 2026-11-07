import { useState } from 'react';
import { X } from 'lucide-react';
import { API } from '../api';

const sports = ['Cricket', 'Football', 'Athletics', 'Basketball', 'Kabaddi', 'Badminton', 'Volleyball', 'Tennis', 'Other'];

function TextField({ label, name, value = '', type = 'text', ...props }) {
  return <div><label className="label" htmlFor={`profile-${name}`}>{label}</label><input id={`profile-${name}`} name={name} type={type} defaultValue={value ?? ''} className="input" {...props}/></div>;
}

function SportField({ value = '' }) {
  return <div><label className="label" htmlFor="profile-sport">Sport</label><select id="profile-sport" name="sport" defaultValue={value} className="input"><option value="">Choose a sport</option>{sports.map(sport=><option key={sport} value={sport}>{sport}</option>)}</select></div>;
}

function ProfileEditor({ profile, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const player = profile.player_details;
  const coach = profile.coach_details;

  const submit = async event => {
    event.preventDefault();
    const phone = new FormData(event.currentTarget).get('phone');
    const digits = String(phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (phone && (!/^[6-9]\d{9}$/.test(digits) || [...digits].some(digit => [...digits].filter(item => item === digit).length > 6))) {
      alert('Enter a 10-digit mobile number starting with 6, 7, 8, or 9; no digit may appear more than 6 times.');
      return;
    }
    setSaving(true);
    const data = new FormData(event.currentTarget);
    for (const name of ['photo', 'certificate']) {
      const file = data.get(name);
      if (!(file instanceof File) || !file.name) data.delete(name);
    }
    try {
      await API.patch('/me/', data);
      onClose();
      await onSaved();
      alert('Profile updated.');
    } catch (error) {
      alert(error.response?.data?.detail || JSON.stringify(error.response?.data) || 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
    <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
      <div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-black">Edit profile</h2><button type="button" onClick={onClose} aria-label="Close profile editor" className="rounded-xl p-2 hover:bg-slate-100"><X/></button></div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Username (cannot be changed)" name="username" value={profile.user.username} disabled/>
          <TextField label="Email" name="email" type="email" value={profile.email} required/>
          <TextField label="First name" name="first_name" value={profile.user.first_name}/>
          <TextField label="Last name" name="last_name" value={profile.user.last_name}/>
          <TextField label="Mobile" name="phone" value={profile.phone} inputMode="tel" pattern="(?:\+91)?[6-9][0-9]{9}" maxLength={13}/>
          <TextField label="Location" name="location" value={profile.location}/>
          <TextField label="PIN code (India)" name="pincode" value={profile.pincode} inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6}/>
          <TextField label="Interests (comma-separated sports)" name="interests" value={profile.interests}/>
        </div>
        <div><label className="label" htmlFor="profile-bio">Bio</label><textarea id="profile-bio" name="bio" defaultValue={profile.bio || ''} className="input min-h-28"/></div>
        <div><label className="label" htmlFor="profile-photo">Profile photo</label><input id="profile-photo" name="photo" type="file" accept="image/*" onChange={event=>{const file=event.target.files?.[0];if(file&&file.size>1024*1024){alert('Profile photos must not exceed 1 MB.');event.target.value='';}}} className="block w-full rounded-xl border p-3 text-sm"/><p className="mt-1 text-xs text-slate-500">Maximum file size: 1 MB.</p></div>
        {player&&<section className="space-y-4 border-t pt-4"><h3 className="font-black">Player details</h3><div className="grid gap-4 md:grid-cols-2">
          <TextField label="Age" name="age" type="number" min="0" value={player.age}/>
          <div><label className="label" htmlFor="profile-gender">Gender</label><select id="profile-gender" name="gender" defaultValue={player.gender || ''} className="input"><option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option></select></div>
          <SportField value={player.sport}/>
          <TextField label="Experience (years)" name="experience" type="number" min="0" value={player.experience}/>
          <TextField label="Level" name="level" value={player.level}/>
          <TextField label="District" name="district" value={player.district}/>
          <TextField label="State" name="state" value={player.state}/>
          <TextField label="Ranking" name="ranking" value={player.ranking}/>
        </div><div><label className="label" htmlFor="profile-statistics">Statistics</label><textarea id="profile-statistics" name="statistics" defaultValue={player.statistics || ''} className="input min-h-24"/></div></section>}
        {coach&&<section className="space-y-4 border-t pt-4"><h3 className="font-black">Coach details</h3><div className="grid gap-4 md:grid-cols-2">
          <TextField label="Age" name="age" type="number" min="0" value={coach.age}/>
          <SportField value={coach.sport}/>
          <TextField label="Experience (years)" name="experience" type="number" min="0" value={coach.experience}/>
          <TextField label="Gender" name="gender" value={coach.gender}/>
          <TextField label="Coaching academy" name="academy" value={coach.academy}/>
          <TextField label="Government recognition" name="government_recognition" value={coach.government_recognition}/>
        </div><div><label className="label" htmlFor="profile-certificate">Coaching certificate</label><input id="profile-certificate" name="certificate" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={event=>{const file=event.target.files?.[0];if(file&&file.size>5*1024*1024){alert('Coaching certificates must not exceed 5 MB.');event.target.value='';}}} className="block w-full rounded-xl border p-3 text-sm"/><p className="mt-1 text-xs text-slate-500">Maximum file size: 5 MB.</p></div></section>}
        <button disabled={saving} className="btn-primary w-full">{saving?'Saving...':'Save changes'}</button>
      </form>
    </div>
  </div>;
}

export default ProfileEditor;
