-- CreateTable
CREATE TABLE "knowledge_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "parent_id" INTEGER,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_materials" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "content" TEXT,
    "material_type" VARCHAR(50) NOT NULL,
    "file_path" VARCHAR(1000),
    "file_size" INTEGER,
    "mime_type" VARCHAR(255),
    "avatar_path" VARCHAR(1000),
    "created_by" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_categories_parent_id_idx" ON "knowledge_categories"("parent_id");

-- CreateIndex
CREATE INDEX "knowledge_categories_order_index_idx" ON "knowledge_categories"("order_index");

-- CreateIndex
CREATE INDEX "knowledge_materials_category_id_idx" ON "knowledge_materials"("category_id");

-- CreateIndex
CREATE INDEX "knowledge_materials_created_by_idx" ON "knowledge_materials"("created_by");

-- CreateIndex
CREATE INDEX "knowledge_materials_is_published_idx" ON "knowledge_materials"("is_published");

-- CreateIndex
CREATE INDEX "knowledge_materials_order_index_idx" ON "knowledge_materials"("order_index");

-- AddForeignKey
ALTER TABLE "knowledge_categories" ADD CONSTRAINT "knowledge_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "knowledge_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_materials" ADD CONSTRAINT "knowledge_materials_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "knowledge_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_materials" ADD CONSTRAINT "knowledge_materials_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
