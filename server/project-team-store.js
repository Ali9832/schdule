export function memoryProjectTeamStore(memory){
  const state=()=>{const s=memory.project_team ||= {members:[],assignees:[]};s.connections ||= [];return s}
  return {
    async list(userId){const s=state();return structuredClone({members:s.members.filter(r=>r.user_id===userId),assignees:s.assignees.filter(r=>r.user_id===userId),connections:s.connections.filter(r=>r.user_id===userId)})},
    async addConnection(row){const s=state();if(s.connections.some(c=>c.user_id===row.user_id&&c.project_id===row.project_id&&c.target_type===row.target_type&&c.target_id===row.target_id))return null;s.connections.push(row);return row},
    async removeConnection(userId,projectId,id){const s=state(),i=s.connections.findIndex(c=>c.user_id===userId&&c.project_id===projectId&&c.id===id);if(i<0)return false;s.connections.splice(i,1);return true},
    async create(row){const s=state();if(s.members.some(m=>m.user_id===row.user_id&&m.project_id===row.project_id&&m.person_id===row.person_id))return null;s.members.push(row);return row},
    async update(row,version){const s=state(),i=s.members.findIndex(m=>m.id===row.id&&m.user_id===row.user_id&&m.version===version);if(i<0)return null;s.members[i]=row;return row},
    async remove(userId,projectId,id,version){const s=state(),i=s.members.findIndex(m=>m.id===id&&m.user_id===userId&&m.project_id===projectId&&m.version===version);if(i<0)return false;const [row]=s.members.splice(i,1);s.assignees=s.assignees.filter(a=>!(a.user_id===userId&&a.project_id===projectId&&a.person_id===row.person_id));return true},
    async assign(userId,projectId,taskId,personId){const s=state();s.assignees=s.assignees.filter(a=>!(a.user_id===userId&&a.task_id===taskId));if(personId)s.assignees.push({user_id:userId,project_id:projectId,task_id:taskId,person_id:personId});},
    async cleanProject(userId,projectId){const s=state();s.members=s.members.filter(m=>!(m.user_id===userId&&m.project_id===projectId));s.assignees=s.assignees.filter(m=>!(m.user_id===userId&&m.project_id===projectId));s.connections=s.connections.filter(m=>!(m.user_id===userId&&m.project_id===projectId));},
    async cleanTask(userId,taskId){state().assignees=state().assignees.filter(m=>!(m.user_id===userId&&m.task_id===taskId))}
  }
}
export function postgresProjectTeamStore(pg){
  return {
    async list(userId){const [m,a,c]=await Promise.all([pg.query('SELECT * FROM project_members WHERE user_id=$1 ORDER BY created_at,id',[userId]),pg.query('SELECT * FROM task_responsibilities WHERE user_id=$1',[userId]),pg.query('SELECT * FROM project_connections WHERE user_id=$1',[userId])]);return {members:m.rows,assignees:a.rows,connections:c.rows}},
    async addConnection(row){return (await pg.query('INSERT INTO project_connections (id,user_id,project_id,target_type,target_id,created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id,project_id,target_type,target_id) DO NOTHING RETURNING *',[row.id,row.user_id,row.project_id,row.target_type,row.target_id,row.created_at])).rows[0]},
    async removeConnection(userId,projectId,id){return (await pg.query('DELETE FROM project_connections WHERE user_id=$1 AND project_id=$2 AND id=$3',[userId,projectId,id])).rowCount>0},
    async create(row){return (await pg.query('INSERT INTO project_members (id,user_id,project_id,person_id,responsibility,due_date,status,notes,version,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (user_id,project_id,person_id) DO NOTHING RETURNING *',[row.id,row.user_id,row.project_id,row.person_id,row.responsibility,row.due_date,row.status,row.notes,row.version,row.created_at,row.updated_at])).rows[0]},
    async update(row,version){return (await pg.query('UPDATE project_members SET responsibility=$1,due_date=$2,status=$3,notes=$4,version=version+1,updated_at=NOW() WHERE id=$5 AND user_id=$6 AND project_id=$7 AND version=$8 RETURNING *',[row.responsibility,row.due_date,row.status,row.notes,row.id,row.user_id,row.project_id,version])).rows[0]},
    async remove(userId,projectId,id,version){return (await pg.query('DELETE FROM project_members WHERE user_id=$1 AND project_id=$2 AND id=$3 AND version=$4',[userId,projectId,id,version])).rowCount>0},
    async assign(userId,projectId,taskId,personId){if(!personId){await pg.query('DELETE FROM task_responsibilities WHERE user_id=$1 AND task_id=$2',[userId,taskId]);return;}await pg.query('INSERT INTO task_responsibilities (user_id,project_id,task_id,person_id) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id,task_id) DO UPDATE SET project_id=EXCLUDED.project_id,person_id=EXCLUDED.person_id',[userId,projectId,taskId,personId])},
    async cleanProject(){/* PostgreSQL foreign keys remove the assignment rows. */},
    async cleanTask(userId,taskId){await pg.query('DELETE FROM task_responsibilities WHERE user_id=$1 AND task_id=$2',[userId,taskId])}
  }
}
