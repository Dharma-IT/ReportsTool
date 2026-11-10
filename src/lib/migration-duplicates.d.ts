type Contact = { name: string; phone: string; email: string }
type Batch = { number: number; contacts: Contact[] }
export function uniqueMigrationContacts(contacts: Contact[], seen?: Set<string>): { contacts: Contact[]; duplicates: number }
export function rebuildMigrationExports(batches: Batch[], pending: Contact[], done: boolean): { batches: Batch[]; pending: Contact[]; duplicates: number }
