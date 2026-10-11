/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Campus } from "@/domain/calendar";

export const TIME_ZONE = process.env.APP_TIME_ZONE ?? "Asia/Kuala_Lumpur";
export const CAMPUS: Campus = process.env.APP_CAMPUS === "Johor" ? "Johor" : "KL";
