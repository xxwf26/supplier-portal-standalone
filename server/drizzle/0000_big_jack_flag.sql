CREATE TABLE `suppliers` (
	`id` varchar(36) NOT NULL,
	`account_name` varchar(255) NOT NULL,
	`social_links` json,
	`sub_category` text,
	`cooperation_type` varchar(255),
	`price_range` text,
	`cooperation_count` int DEFAULT 0,
	`rating` int,
	`risk_status` varchar(255) DEFAULT '暂无',
	`is_in_stock` boolean DEFAULT true,
	`entity_type` varchar(255),
	`contract_entity` varchar(255),
	`contract_type` varchar(255),
	`contract_no` varchar(255),
	`contract_deadline` date,
	`tax_status` varchar(255),
	`contact_info` text,
	`cooperation_category` varchar(255),
	`supplier_type` varchar(255),
	`artwork_urls` json,
	`manual_links` json,
	`import_source` varchar(255) DEFAULT 'manual',
	`import_batch_id` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_account_name` ON `suppliers` (`account_name`);--> statement-breakpoint
CREATE INDEX `idx_cooperation_category` ON `suppliers` (`cooperation_category`);--> statement-breakpoint
CREATE INDEX `idx_entity_type` ON `suppliers` (`entity_type`);--> statement-breakpoint
CREATE INDEX `idx_import_batch_id` ON `suppliers` (`import_batch_id`);--> statement-breakpoint
CREATE INDEX `idx_risk_status` ON `suppliers` (`risk_status`);--> statement-breakpoint
CREATE INDEX `idx_supplier_type` ON `suppliers` (`supplier_type`);