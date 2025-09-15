import { relations } from "drizzle-orm/relations";
import { supportTickets, supportTicketResponses } from "./schema";

export const supportTicketResponsesRelations = relations(supportTicketResponses, ({one}) => ({
	supportTicket: one(supportTickets, {
		fields: [supportTicketResponses.ticketId],
		references: [supportTickets.id]
	}),
}));

export const supportTicketsRelations = relations(supportTickets, ({many}) => ({
	supportTicketResponses: many(supportTicketResponses),
}));