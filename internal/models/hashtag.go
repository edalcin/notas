package models

type Hashtag struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
	Color string `json:"color"`
}

type HashtagsResponse struct {
	Hashtags []Hashtag `json:"hashtags"`
}
