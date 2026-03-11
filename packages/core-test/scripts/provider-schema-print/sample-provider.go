package demo

import "github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"

func resourceDemoThing() *schema.Resource {
	return &schema.Resource{
		Schema: map[string]*schema.Schema{
			"name": {
				Type:        schema.TypeString,
				Required:    true,
				Description: "The name of the demo resource.",
			},
			"tags": {
				Type:     schema.TypeMap,
				Optional: true,
				Elem: &schema.Schema{
					Type: schema.TypeString,
				},
				Description: "Arbitrary tags for the demo resource.",
			},
			"member": {
				Type:     schema.TypeList,
				Optional: true,
				Elem: &schema.Resource{
					Schema: map[string]*schema.Schema{
						"host": {
							Type:        schema.TypeString,
							Required:    true,
							Description: "Backend host.",
						},
						"weight": {
							Type:        schema.TypeInt,
							Optional:    true,
							Default:     1,
							Description: "Backend weight.",
						},
					},
				},
				Description: "Members for load balancing.",
			},
			"enabled": {
				Type:        schema.TypeBool,
				Optional:    true,
				Computed:    true,
				Description: "Whether the resource is enabled.",
			},
		},
	}
}
