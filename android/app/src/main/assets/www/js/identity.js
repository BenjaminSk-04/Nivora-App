/* =====================================================================
   identity.js - the stable internal "me" key and display-name helpers.
   ===================================================================== */


/* The signed-in user is always represented internally by this fixed key — never by their
   display name, which can change. This keeps old records (who paid, who owes whom) stable
   even if the person later edits their name in Settings. displayName()/nameOf() below turn
   it back into something human for the UI. */
const ME = '__me__';

function displayName(key) { return key === ME ? (state.user.name || 'You') : key; }

function nameOf(key) { return key === ME ? 'You' : key; }

function membersList() { return [ME, ...(state.flatmates || [])]; }
