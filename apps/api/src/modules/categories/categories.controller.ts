import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators";
import { CategoriesService } from "./categories.service";

@ApiTags("Categories")
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "List enabled rental categories" })
  list() {
    return this.categories.listEnabled();
  }

  @Public()
  @Get(":slug")
  @ApiOperation({
    summary: "Category detail: attribute schema, search-filter definitions, pricing units, booking rules",
    description:
      "Clients build their search UI and listing forms from this schema — adding a new category requires zero client changes. Disabled categories return 403 CATEGORY_DISABLED.",
  })
  get(@Param("slug") slug: string) {
    return this.categories.publicSchema(slug);
  }
}
